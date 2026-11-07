import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function SupportCheckout({ target, name }: {target:string;name:string}) {
 const [amount,setAmount]=useState('5');
 // Supporters appear on the artiste page with their profile picture by default.
 // Uncheck to stay anonymous.
 const [visible,setVisible]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [orders,setOrders]=useState<{reference:string;status:string;amount_subunits:number}[]>([]);
 const load=async()=>{
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;
  let q=supabase.from('support_payment_orders').select('reference,status,amount_subunits').eq('user_id',user.id).order('created_at',{ascending:false}).limit(5);
  q=target==='gyidi'?q.is('artiste_id',null):q.eq('artiste_id',target);
  const {data}=await q;setOrders(data||[]);
 };
 useEffect(()=>{void load();},[target]);
 const call=async(body:object)=>{
  const {data,error}=await supabase.functions.invoke('support-checkout',{body});
  if(error||data?.error){let detail=data?.error;try{detail=(await error?.context?.json())?.error||detail;}catch{}throw Error(detail||'Checkout unavailable. If charged, check your payment; do not pay again.');}return data;
 };
 const checkout=async()=>{
  setBusy(true);setMessage('');
  const paymentWindow=window.open('about:blank','_blank');
  if(paymentWindow)paymentWindow.opener=null;
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw Error('Please sign in first so your support is linked to your account.');
   if(!/^\d+(\.\d{1,2})?$/.test(amount))throw Error('Enter a valid amount with at most two decimal places.');
   const units=Math.round(Number(amount)*100);if(units<100||units>1000000)throw Error('Choose GHS 1 to GHS 10,000.');
   const result=await call({action:'initialize',target,amount_subunits:units,publicly_visible:visible});
   const url=new URL(result.authorization_url);if(url.protocol!=='https:'||url.hostname!=='checkout.paystack.com')throw Error('Invalid checkout address.');
   if(paymentWindow){paymentWindow.location.href=url.href;setMessage('Complete payment in the Paystack tab, then return here and choose Check payment.');}
   else window.location.assign(url.href);
  }catch(e){paymentWindow?.close();setMessage(e instanceof Error?e.message:'Checkout unavailable.');}finally{setBusy(false);void load();}
 };
 const verify=async(reference:string)=>{
  setBusy(true);try{const result=await call({action:'verify',reference});setMessage(result.verified?'Payment verified. Thank you for your support!':result.message);await load();}catch(e){setMessage(e instanceof Error?e.message:'Unable to check.');}finally{setBusy(false);}
 };
 return <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-zinc-900 p-4">
  <p className="text-xs text-zinc-300">Support {name} securely through Paystack. Payout details stay private. You authorize each payment on Paystack.</p>
  <label className="block text-xs text-zinc-300">Amount (GHS)<input aria-label="Support amount in GHS" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-1 block w-full rounded-lg bg-zinc-950 border border-white/10 p-2 text-white" /></label>
  <label className="flex items-start gap-2 text-xs text-zinc-300"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)} />Show my profile name and photo on the artiste page. Uncheck to remain anonymous.</label>
  <button disabled={busy} onClick={checkout} className="min-h-11 w-full rounded-xl bg-amber-400 px-4 py-2 font-bold text-zinc-950 disabled:opacity-50">{busy?'Please wait…':'Continue to Paystack'}</button>
  {message&&<p role="status" className="text-xs text-zinc-300">{message}</p>}
  {orders.length>0&&<div className="space-y-2"><p className="text-xs text-zinc-400">Your recent support payments</p>{orders.map(o=><div key={o.reference} className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300"><span>GHS {(o.amount_subunits/100).toFixed(2)} · {o.status==='verified'?'Verified supporter':'Not yet verified'}</span>{o.status!=='verified'&&<button disabled={busy} onClick={()=>void verify(o.reference)} className="min-h-11 text-amber-300 font-bold">Check payment</button>}</div>)}</div>}
 </div>;
}
