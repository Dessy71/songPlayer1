import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
class PaymentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const validReference = (reference: unknown): reference is string => typeof reference === 'string' && /^GN-SUPPORT-[a-f0-9-]{36}$/.test(reference);

export async function validSignature(raw: Uint8Array, signature: string, secret: string): Promise<boolean> {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, raw));
  let diff = 0;
  for (let i = 0; i < digest.length; i++) diff |= digest[i] ^ parseInt(signature.slice(i * 2, i * 2 + 2), 16);
  return diff === 0;
}

export function assertVerifiedSupport(payment: any, order: any) {
  if (!payment || payment.status !== 'success' || payment.reference !== order.reference ||
      payment.currency !== 'GHS' || !Number.isSafeInteger(payment.amount) ||
      payment.amount !== Number(order.amount_subunits) || !payment.id ||
      !payment.paid_at || !Number.isFinite(Date.parse(payment.paid_at)) ||
      Date.parse(payment.paid_at) > Date.now() + 300000 ||
      payment.customer?.email?.toLowerCase() !== order.customer_email.toLowerCase()) {
    throw new PaymentError('Payment is not verified for this account, currency and amount. Do not pay again unless you cancelled or payment failed.');
  }
  const metadata = typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : payment.metadata;
  if (metadata?.purpose !== 'support' || metadata?.user_id !== order.user_id ||
      metadata?.artiste_id !== order.artiste_id || metadata?.support_reference !== order.reference) {
    throw new PaymentError('Support payment does not match its trusted order.');
  }
  const validId = (typeof payment.id === 'string' && /^[1-9][0-9]*$/.test(payment.id)) ||
    (typeof payment.id === 'number' && Number.isSafeInteger(payment.id) && payment.id > 0);
  if (!validId) throw new PaymentError('Invalid payment transaction id.');
  if (order.subaccount_code && payment.subaccount?.subaccount_code !== order.subaccount_code) {
    throw new PaymentError('Payment subaccount mismatch.');
  }
  return { transactionId: String(payment.id), paidAt: new Date(Date.parse(payment.paid_at)).toISOString() };
}

export function createSupportHandler(env:(key:string)=>string|undefined, clientFactory=createClient, request=fetch) {
 return async(req:Request)=>{
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(req.method==='OPTIONS')return json({});
  if(req.method!=='POST')return json({error:'POST required'},405);
  try{
   const secret=env('PAYSTACK_SECRET_KEY');if(!secret)return json({error:'Support checkout is not configured.'},503);
   const admin=clientFactory(env('SUPABASE_URL')!,env('SUPABASE_SERVICE_ROLE_KEY')!);
   const webhook = new URL(req.url).searchParams.get('webhook') === '1';

   const paystack=async(path:string,body?:object)=>{
    const response=await request(`https://api.paystack.co/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok||!result.status)throw Error('Provider unavailable');return result.data;
   };

   if (webhook) {
    // Signature must cover the exact raw bytes, before JSON parsing.
    const raw = new Uint8Array(await req.arrayBuffer());
    if (raw.byteLength > 262144) throw new PaymentError('Payload too large.', 413);
    if (!await validSignature(raw, req.headers.get('x-paystack-signature') || '', secret)) throw new PaymentError('Invalid signature.', 401);
    const event = JSON.parse(new TextDecoder().decode(raw));
    if (event.event !== 'charge.success') return json({ received: true, ignored: true });
    try {
      const reference = event.data?.reference;
      if (!validReference(reference)) return json({ received: true, ignored: true });
      const { data: stored, error: orderError } = await admin.from('support_payment_orders').select('*').eq('reference', reference).maybeSingle();
      if (orderError) throw orderError;
      if (!stored || stored.status === 'verified') return json({ received: true, ignored: true });
      const p = await paystack(`transaction/verify/${encodeURIComponent(reference)}`);
      assertVerifiedSupport(p, stored);
      const { error: receiptError } = await admin.rpc('fulfill_verified_support', {
        p_reference: reference,
        p_transaction_id: String(p.id),
        p_paid_at: p.paid_at,
      });
      if (receiptError) throw receiptError;
      return json({ received: true });
    } catch (error) {
      if (error instanceof PaymentError && error.status === 404) return json({ received: true, ignored: true });
      throw error;
    }
   }

   // Non-webhook requests require authentication
   const userClient=clientFactory(env('SUPABASE_URL')!,env('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
   const {data:{user},error:authError}=await userClient.auth.getUser();
   if(authError||!user?.email)return json({error:'Sign in before supporting.'},401);

   const body=await req.json();
   if(body.action==='initialize'){
    if(!Number.isSafeInteger(body.amount_subunits)||body.amount_subunits<100||body.amount_subunits>1000000)return json({error:'Choose an amount from GHS 1 to GHS 10,000.'},400);
    if(typeof body.target!=='string'||!(/^[a-f0-9-]{36}$/.test(body.target)||body.target==='gyidi'))return json({error:'Invalid support recipient.'},400);
    const {data:config,error:configError}=await admin.from('support_checkout_config').select('*').eq('target',body.target).eq('enabled',true).maybeSingle();
    if(configError)throw configError;if(!config)return json({error:'Support checkout has not been approved for this recipient yet.'},409);
    const {count,error:rateError}=await admin.from('support_payment_orders').select('reference',{count:'exact',head:true}).eq('user_id',user.id).gte('created_at',new Date(Date.now()-600000).toISOString());
    if(rateError)throw rateError;if((count||0)>=5)return json({error:'Too many attempts. Check your existing payment or wait ten minutes.'},429);
    // Validate provider-owned recipient before offering a live checkout. Do not override fees/percentages.
    if(config.subaccount_code){const account=await paystack(`subaccount/${encodeURIComponent(config.subaccount_code)}`);if(account.subaccount_code!==config.subaccount_code||account.active===false)throw Error('Recipient unavailable');}
    const reference=`GN-SUPPORT-${crypto.randomUUID()}`;
    const order={reference,user_id:user.id,artiste_id:config.artiste_id,customer_email:user.email,amount_subunits:body.amount_subunits,subaccount_code:config.subaccount_code,domain:secret.startsWith('sk_live_')?'live':'test',publicly_visible:body.publicly_visible===true};
    const {error}=await admin.from('support_payment_orders').insert(order);if(error)throw error;
    const checkout=await paystack('transaction/initialize',{reference,email:user.email,amount:String(order.amount_subunits),currency:'GHS',channels:['mobile_money','card'],...(config.subaccount_code?{subaccount:config.subaccount_code}:{}),callback_url:`${env('PAYMENT_APP_URL')||'https://gyidi-nwom.vercel.app'}/?support_return=1`,metadata:{purpose:'support',user_id:user.id,artiste_id:config.artiste_id,support_reference:reference}});
    const destination=new URL(checkout.authorization_url);if(destination.protocol!=='https:'||destination.hostname!=='checkout.paystack.com'||checkout.reference!==reference)throw Error('Invalid checkout response');
    return json({reference,authorization_url:destination.href});
   }
   if(body.action==='verify'){
    if(typeof body.reference!=='string'||!validReference(body.reference))return json({error:'Invalid reference.'},400);
    const {data:o,error}=await admin.from('support_payment_orders').select('*').eq('reference',body.reference).eq('user_id',user.id).maybeSingle();
    if(error)throw error;if(!o)return json({error:'Payment not found for this account.'},404);
    const p=await paystack(`transaction/verify/${encodeURIComponent(o.reference)}`);
    assertVerifiedSupport(p, o);
    const {error:receiptError}=await admin.rpc('fulfill_verified_support',{p_reference:o.reference,p_transaction_id:String(p.id),p_paid_at:p.paid_at});if(receiptError)throw receiptError;
    return json({verified:true});
   }
   return json({error:'Unknown action.'},400);
  }catch{
   return json({error:'Support payment service is unavailable. If charged, check your existing payment; do not pay again.'},503);
  }
 };
}
Deno.serve(createSupportHandler(key=>Deno.env.get(key)));
