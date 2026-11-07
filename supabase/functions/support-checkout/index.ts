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

   // ---------------------------------------------------------------------
   // Paystack payment-page (storefront) donations
   // ---------------------------------------------------------------------
   // The Support button on an artiste profile opens the artiste's Paystack
   // payment page (https://paystack.shop/pay/<tag>) straight in a new tab, so no
   // local order row exists when Paystack reports charge.success: the reference is
   // Paystack-generated and the metadata carries none of our fields. Those charges
   // are adopted here instead. The subaccount identifies the artiste, the payer
   // email identifies the supporter, and the charge is re-verified with Paystack
   // server-to-server before any supporter badge is awarded.
   const PROVIDER_REFERENCE = /^[A-Za-z0-9_-]{6,64}$/;
   const SUBACCOUNT = /^ACCT_[a-zA-Z0-9]+$/;
   const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
   // Migration 202611070003 seeds every artiste with this shared fake subaccount.
   // It identifies nobody, so a charge against it must never become a badge.
   const PLACEHOLDER_SUBACCOUNT = 'ACCT_placeholder0000';

   // trustProvider is only safe for charges read straight back from the Paystack API
   // (the admin sync); a webhook body is attacker-supplied until re-verified.
   const adoptPayment = async (payment: any, trustProvider = false): Promise<{ adopted: boolean; reason?: string }> => {
    const reference = payment?.reference;
    if (typeof reference !== 'string' || !PROVIDER_REFERENCE.test(reference)) return { adopted: false, reason: 'unsupported-reference' };
    if (payment?.status !== 'success' || payment?.currency !== 'GHS') return { adopted: false, reason: 'not-a-ghs-success' };
    if (!Number.isSafeInteger(payment.amount) || payment.amount < 100 || payment.amount > 1000000) return { adopted: false, reason: 'amount-out-of-range' };

    const subaccountCode = payment?.subaccount?.subaccount_code;
    const email = payment?.customer?.email;
    if (typeof subaccountCode !== 'string' || !SUBACCOUNT.test(subaccountCode)) return { adopted: false, reason: 'unlinked-artiste' };
    if (typeof email !== 'string' || !EMAIL.test(email)) return { adopted: false, reason: 'missing-email' };

    if (subaccountCode === PLACEHOLDER_SUBACCOUNT) return { adopted: false, reason: 'placeholder-subaccount' };

    // subaccount_code is NOT unique, so never use maybeSingle() here: several
    // artistes can point at the same code and PostgREST would error out.
    const { data: candidates, error: configError } = await admin.from('support_checkout_config')
      .select('artiste_id, subaccount_code, payment_page_url').eq('subaccount_code', subaccountCode).not('artiste_id', 'is', null);
    if (configError) throw configError;
    if (!candidates || candidates.length === 0) return { adopted: false, reason: 'unlinked-artiste' };

    // Paystack puts the storefront a charge came from in metadata.referrer
    // (https://paystack.shop/pay/<tag>). Prefer that exact page when it is present.
    const referrer = payment?.metadata?.referrer;
    const byPage = typeof referrer === 'string'
      ? candidates.find((c: any) => typeof c.payment_page_url === 'string' && c.payment_page_url === referrer)
      : undefined;
    // Refuse to guess when a shared subaccount leaves more than one candidate.
    if (!byPage && candidates.length > 1) return { adopted: false, reason: 'ambiguous-artiste' };
    const config = byPage ?? candidates[0];
    if (!config?.artiste_id) return { adopted: false, reason: 'unlinked-artiste' };

    const { data: existing, error: existingError } = await admin.from('support_payment_orders')
      .select('reference,status').eq('reference', reference).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === 'verified') return { adopted: false, reason: 'already-verified' };

    // Never trust the webhook body alone: confirm the charge with Paystack.
    let verified: any = payment;
    if (!trustProvider) {
      try { verified = await paystack(`transaction/verify/${encodeURIComponent(reference)}`); }
      catch { return { adopted: false, reason: 'verify-unavailable' }; }
    }
    if (verified?.status !== 'success' || verified.reference !== reference || verified.currency !== 'GHS' ||
        Number(verified.amount) !== Number(payment.amount) ||
        String(verified?.customer?.email ?? '').toLowerCase() !== email.toLowerCase() ||
        verified?.subaccount?.subaccount_code !== subaccountCode) return { adopted: false, reason: 'verify-mismatch' };

    const transactionId = String(verified.id ?? payment.id ?? '');
    const paidAt = verified.paid_at ?? payment.paid_at;
    if (!/^[1-9][0-9]*$/.test(transactionId) || typeof paidAt !== 'string' || !Number.isFinite(Date.parse(paidAt))) {
      return { adopted: false, reason: 'invalid-receipt' };
    }
    const receipt = { p_reference: reference, p_transaction_id: transactionId, p_paid_at: new Date(Date.parse(paidAt)).toISOString() };

    // A row left pending by an earlier failed attempt only needs completing.
    if (existing) {
      const { error } = await admin.rpc('fulfill_verified_support', receipt);
      if (error) return { adopted: false, reason: 'fulfil-failed' };
      return { adopted: true };
    }

    const { data: userId, error: userError } = await admin.rpc('support_user_id_by_email', { p_email: email });
    if (userError || !userId) return { adopted: false, reason: 'no-matching-account' };

    const { error: insertError } = await admin.from('support_payment_orders').insert({
      reference,
      user_id: userId,
      artiste_id: config.artiste_id,
      amount_subunits: Number(payment.amount),
      customer_email: email.toLowerCase(),
      subaccount_code: subaccountCode,
      domain: payment.domain === 'live' ? 'live' : 'test',
      publicly_visible: false,
      status: 'pending',
    });
    // Lost a race with a concurrent webhook retry: fall through and complete it.
    if (insertError) {
      const { data: raced } = await admin.from('support_payment_orders').select('status').eq('reference', reference).maybeSingle();
      if (raced?.status !== 'verified') {
        const { error } = await admin.rpc('fulfill_verified_support', receipt);
        if (error) throw error;
        return { adopted: true };
      }
      return { adopted: false, reason: 'already-verified' };
    }

    const { error: receiptError } = await admin.rpc('fulfill_verified_support', receipt);
    if (receiptError) throw receiptError;
    return { adopted: true };
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
      if (!validReference(reference)) {
        // Donation made straight on the artiste's Paystack payment page.
        const outcome = await adoptPayment(event.data);
        return json(outcome.adopted
          ? { received: true, adopted: true }
          : { received: true, ignored: true, reason: outcome.reason });
      }
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
   if(body.action==='reconcile'){
    // Admin only. Adopts successful Paystack charges the webhook never turned into
    // supporter badges — payments made before the webhook was connected, or whose
    // delivery attempts all failed. Read-only apart from the adoption itself.
    const {data:profile,error:profileError}=await admin.from('profiles').select('role').eq('id',user.id).maybeSingle();
    if(profileError)throw profileError;
    if(profile?.role!=='admin'){
     console.warn('reconcile rejected: caller is not an admin',{userId:user.id,role:profile?.role ?? null});
     return json({error:'Admins only.'},403);
    }
    const days=Number.isSafeInteger(body.days)?Math.min(Math.max(body.days,1),90):30;
    const from=new Date(Date.now()-days*86400000).toISOString().slice(0,10);
    const {data:configs,error:configError}=await admin.from('support_checkout_config')
      .select('subaccount_code').eq('enabled',true).not('subaccount_code','is',null);
    if(configError)throw configError;
    const linked=new Set((configs||[]).map((c:any)=>c.subaccount_code)
      .filter((c:unknown):c is string=>typeof c==='string'&&c!==PLACEHOLDER_SUBACCOUNT));
    console.log('reconcile start',{days,from,linkedSubaccounts:[...linked],configCount:configs?.length ?? 0,placeholderRowsExcluded:(configs||[]).filter((c:any)=>c.subaccount_code===PLACEHOLDER_SUBACCOUNT).length});
    if(linked.size===0)return json({adopted:0,scanned:0,skipped:[]});
    let scanned=0,adopted=0;const skipped:string[]=[];
    for(let page=1;page<=5;page++){
     let list:any[];
     try{list=await paystack(`transaction?status=success&from=${encodeURIComponent(from)}&perPage=100&page=${page}`);}
     catch{break;}
     if(!Array.isArray(list)||list.length===0)break;
     scanned+=list.length;
     for(const row of list){
      // The list endpoint can omit the split details, so fall back to the full charge.
      let payment:any=row;
      if(payment?.subaccount?.subaccount_code==null&&typeof row?.reference==='string'&&PROVIDER_REFERENCE.test(row.reference)){
       try{payment=await paystack(`transaction/verify/${encodeURIComponent(row.reference)}`);}
       catch{continue;}
      }
      if(typeof payment?.subaccount?.subaccount_code!=='string'||!linked.has(payment.subaccount.subaccount_code))continue;
      const outcome=await adoptPayment(payment,true);
      if(outcome.adopted)adopted+=1;
      else if(outcome.reason)skipped.push(`${row?.reference}:${outcome.reason}`);
     }
     if(list.length<100)break;
    }
    console.log('reconcile finished',{days,from,linkedSubaccounts:[...linked],scanned,adopted,skipped:skipped.slice(0,20)});
    return json({adopted,scanned,skipped:skipped.slice(0,20)});
   }
   return json({error:'Unknown action.'},400);
  }catch(error){
   // Previously this swallowed the cause, so the only signal in the function
   // logs was a bare 503. Log it so the real failure is visible in
   // Dashboard -> Edge Functions -> support-checkout -> Logs.
   console.error('support-checkout failed:', error instanceof Error ? (error.stack || error.message) : error);
   return json({error:'Support payment service is unavailable. If charged, check your existing payment; do not pay again.'},503);
  }
 };
}
Deno.serve(createSupportHandler(key=>Deno.env.get(key)));
