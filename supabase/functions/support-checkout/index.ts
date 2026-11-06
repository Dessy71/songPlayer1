import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
export function createSupportHandler(env:(key:string)=>string|undefined, clientFactory=createClient, request=fetch) {
 return async(req:Request)=>{
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(req.method==='OPTIONS')return json({});
  if(req.method!=='POST')return json({error:'POST required'},405);
  try{
   const secret=env('PAYSTACK_SECRET_KEY');if(!secret)return json({error:'Support checkout is not configured.'},503);
   const admin=clientFactory(env('SUPABASE_URL')!,env('SUPABASE_SERVICE_ROLE_KEY')!);
   const userClient=clientFactory(env('SUPABASE_URL')!,env('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
   const {data:{user},error:authError}=await userClient.auth.getUser();
   if(authError||!user?.email)return json({error:'Sign in before supporting.'},401);
   const paystack=async(path:string,body?:object)=>{
    const response=await request(`https://api.paystack.co/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok||!result.status)throw Error('Provider unavailable');return result.data;
   };
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
    if(typeof body.reference!=='string'||!/^GN-SUPPORT-[a-f0-9-]{36}$/.test(body.reference))return json({error:'Invalid reference.'},400);
    const {data:o,error}=await admin.from('support_payment_orders').select('*').eq('reference',body.reference).eq('user_id',user.id).maybeSingle();
    if(error)throw error;if(!o)return json({error:'Payment not found for this account.'},404);
    const p=await paystack(`transaction/verify/${encodeURIComponent(o.reference)}`);
    let m;try{m=typeof p.metadata==='string'?JSON.parse(p.metadata):p.metadata;}catch{return json({error:'Invalid payment metadata.'},409);}
    if(p.status!=='success')return json({verified:false,message:'Payment is not confirmed yet. Check again; do not pay again.'});
    const paidAt=Date.parse(p.paid_at);
    if(p.reference!==o.reference||p.domain!==o.domain||p.currency!=='GHS'||!Number.isSafeInteger(p.amount)||p.amount!==Number(o.amount_subunits)||m?.purpose!=='support'||m.user_id!==o.user_id||m.artiste_id!==o.artiste_id||m.support_reference!==o.reference||p.customer?.email?.toLowerCase()!==o.customer_email.toLowerCase()||!Number.isFinite(paidAt)||paidAt>Date.now()+300000||!(/^[1-9][0-9]*$/.test(String(p.id)))||(typeof p.id==='number'&&!Number.isSafeInteger(p.id))||(o.subaccount_code&&p.subaccount?.subaccount_code!==o.subaccount_code))return json({error:'Payment does not match its account or recipient. Contact support; do not pay again.'},409);
    const {error:receiptError}=await admin.rpc('fulfill_verified_support',{p_reference:o.reference,p_transaction_id:String(p.id),p_paid_at:p.paid_at});if(receiptError)throw receiptError;
    return json({verified:true});
   }
   return json({error:'Unknown action.'},400);
  }catch{return json({error:'Support payment service is unavailable. If charged, check your existing payment; do not pay again.'},503);}
 };
}
Deno.serve(createSupportHandler(key=>Deno.env.get(key)));
