import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto, createHmac } from 'node:crypto';

const context = vm.createContext({ crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, Response, Request, URL, AbortSignal, fetch, console: { error() {} }, Deno: { serve() {}, env: { get() {} } } });
const source = ts.transpileModule(fs.readFileSync('supabase/functions/verify-premium-payment/index.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = new vm.SourceTextModule(source, { context });
const dependency = new vm.SyntheticModule(['createClient'], function() { this.setExport('createClient', () => {}); }, { context });
await module.link(() => dependency); await module.evaluate();
const { validSignature, assertVerifiedPayment, createHandler } = module.namespace;
const order = { reference: 'GN-reference', user_id: 'user-a', plan_interval: 'monthly', amount_subunits: 500, currency: 'GHS', customer_email: 'member@example.com' };
const payment = { id: 1234, reference: order.reference, status: 'success', amount: 500, currency: 'GHS', paid_at: new Date().toISOString(), customer: { email: order.customer_email }, metadata: { user_id: 'user-a', plan_interval: 'monthly' } };
const env = key => ({ SUPABASE_URL: 'https://example.supabase.co', PAYSTACK_SECRET_KEY: 'secret', SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' })[key];

test('HMAC validates exact raw bytes and rejects missing, malformed and forged signatures', async () => {
 const raw = new TextEncoder().encode('{"event":"charge.success"}');
 const signed = createHmac('sha512','secret').update(raw).digest('hex');
 assert.equal(await validSignature(raw,signed,'secret'),true);
 for (const signature of ['', 'invalid', '0'.repeat(128)]) assert.equal(await validSignature(raw,signature,'secret'),false);
 assert.equal(await validSignature(new TextEncoder().encode('{ "event":"charge.success"}'),signed,'secret'),false);
});
test('verification accepts only exact successful ownership, plan, amount and currency', () => {
 assert.doesNotThrow(() => assertVerifiedPayment(payment,order.reference,order));
 for (const change of [{status:'pending'},{amount:1},{currency:'USD'},{reference:'other'}, {paid_at:'invalid'}, {metadata:{user_id:'other',plan_interval:'monthly'}}, {metadata:{user_id:'user-a',plan_interval:'yearly'}}, {customer:{email:'other@example.com'}}]) {
  assert.throws(() => assertVerifiedPayment({...payment,...change},order.reference,order));
 }
});
function dbMock({ dbFails=false }={}) {
 let fulfillments=0;
 const query = { select(){return this;}, eq(){return this;}, maybeSingle:async()=>({data:order,error:null}) };
 return { client: { from:()=>query, rpc:async()=>{fulfillments++;return dbFails?{error:new Error('write failed')}:{data:{id:'profile-a'},error:null};} }, count:()=>fulfillments };
}
function signedRequest(event, secret='secret') {
 const raw=JSON.stringify(event);
 return new Request('https://example.supabase.co/functions/v1/verify-premium-payment?webhook=1',{method:'POST',headers:{'x-paystack-signature':createHmac('sha512',secret).update(raw).digest('hex')},body:raw});
}
test('valid webhook still verifies through Paystack API, never event amount/status', async()=>{
 const db=dbMock(); let checks=0;
 const handler=createHandler(env,()=>db.client,async(url)=>{checks++;assert.match(url,/transaction\/verify\/GN-reference$/);return Response.json({status:true,data:payment});});
 const result=await handler(signedRequest({event:'charge.success',data:{reference:order.reference,amount:1}}));
 assert.equal(result.status,200);assert.equal(checks,1);assert.equal(db.count(),1);
});
test('forged webhook never calls verifier or database activation',async()=>{
 const db=dbMock();let checks=0;
 const handler=createHandler(env,()=>db.client,async()=>{checks++;});
 const result=await handler(signedRequest({event:'charge.success',data:{reference:order.reference}},'forged'));
 assert.equal(result.status,401);assert.equal(checks,0);assert.equal(db.count(),0);
});
test('database failure is not acknowledged so Paystack can retry',async()=>{
 const db=dbMock({dbFails:true});
 const handler=createHandler(env,()=>db.client,async()=>Response.json({status:true,data:payment}));
 assert.equal((await handler(signedRequest({event:'charge.success',data:{reference:order.reference}}))).status,500);
});
test('non-webhook actions require account authentication',async()=>{
 const handler=createHandler(env,()=>({auth:{getUser:async()=>({data:{user:null},error:{message:'invalid'}})}}));
 const response=await handler(new Request('https://example.com/',{method:'POST',body:JSON.stringify({action:'recover'})}));
 assert.equal(response.status,401);
});
test('wrong-account payment cannot be checked using another account session',async()=>{
 const db=dbMock();let checks=0;
 const handler=createHandler(env,(_url,key)=>key==='service'?db.client:{auth:{getUser:async()=>({data:{user:{id:'other'}}})}},async()=>{checks++;});
 assert.equal((await handler(new Request('https://example.com/',{method:'POST',body:JSON.stringify({reference:order.reference})}))).status,404);
 assert.equal(checks,0);assert.equal(db.count(),0);
});
