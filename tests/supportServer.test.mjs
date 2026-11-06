import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {webcrypto}from'node:crypto';
const context=vm.createContext({crypto:webcrypto,Response,Request,URL,AbortSignal,fetch,Deno:{serve(){},env:{get(){}}}});
const source=ts.transpileModule(fs.readFileSync('supabase/functions/support-checkout/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const m=new vm.SourceTextModule(source,{context});const dep=new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>{});},{context});await m.link(()=>dep);await m.evaluate();
const env=k=>({PAYSTACK_SECRET_KEY:'sk_live_test',SUPABASE_URL:'https://example.com',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'anon'})[k];
const target='93fdfca2-aa25-4e6f-ab40-5092a6dbc5c7';
const ref='GN-SUPPORT-11111111-1111-4111-8111-111111111111';
function setup({signedIn=true,config=true,change={},dbFails=false}={}){
 const orders=[];let fulfilled=0,calls=[];
 const order={reference:ref,user_id:'uid',artiste_id:target,amount_subunits:500,customer_email:'a@example.com',subaccount_code:'ACCT_test',domain:'live'};
 const admin={from(table){const q={select(){return q},eq(){return q},gte(){return q},maybeSingle:async()=>({data:table==='support_checkout_config'?(config?{artiste_id:target,subaccount_code:'ACCT_test'}:null):order}),insert:async o=>{orders.push(o);return{error:null}},then(resolve){resolve({count:0,error:null})}};return q;},rpc:async()=>{fulfilled++;return{error:dbFails?Error('write failed'):null}}};
 const factory=(_,key)=>key==='service'?admin:{auth:{getUser:async()=>({data:{user:signedIn?{id:'uid',email:'a@example.com'}:null}})}};
 const request=async(url,options)=>{calls.push({url,options});let data;
 if(url.includes('subaccount/'))data={subaccount_code:'ACCT_test',active:true};
 else if(url.endsWith('/initialize')){const p=JSON.parse(options.body);data={reference:p.reference,authorization_url:'https://checkout.paystack.com/test'};}
 else data={id:123,reference:ref,status:'success',domain:'live',currency:'GHS',amount:500,paid_at:new Date().toISOString(),customer:{email:'a@example.com'},subaccount:{subaccount_code:'ACCT_test'},metadata:{purpose:'support',user_id:'uid',artiste_id:target,support_reference:ref},...change};
 return Response.json({status:true,data});};
 return{handler:m.namespace.createSupportHandler(env,factory,request),orders,calls,fulfilled:()=>fulfilled};
}
const req=body=>new Request('https://example.com/',{method:'POST',body:JSON.stringify(body)});
test('signed out cannot create live checkout',async()=>{const s=setup({signedIn:false});assert.equal((await s.handler(req({action:'initialize'}))).status,401);assert.equal(s.calls.length,0)});
test('initialization uses trusted recipient, no local commission overrides and server-bound identity',async()=>{const s=setup();const r=await s.handler(req({action:'initialize',target,amount_subunits:500,user_id:'attacker',subaccount:'ACCT_wrong'}));assert.equal(r.status,200);const p=JSON.parse(s.calls.at(-1).options.body);assert.equal(p.subaccount,'ACCT_test');assert.equal(p.metadata.user_id,'uid');for(const key of ['transaction_charge','bearer','split_code'])assert.equal(key in p,false);assert.equal(s.orders.length,1);});
test('unapproved recipient never initializes payment',async()=>{const s=setup({config:false});assert.equal((await s.handler(req({action:'initialize',target,amount_subunits:500}))).status,409);assert.equal(s.calls.length,0)});
test('verification rejects wrong recipient, amount, owner and environment',async()=>{for(const change of [{amount:1},{domain:'test'},{subaccount:{subaccount_code:'ACCT_wrong'}},{metadata:{}},{currency:'USD'}]){const s=setup({change});assert.equal((await s.handler(req({action:'verify',reference:ref}))).status,409);assert.equal(s.fulfilled(),0)}});
test('only provider-verified success can fulfill; pending and DB failures remain recoverable',async()=>{let s=setup();assert.equal((await s.handler(req({action:'verify',reference:ref}))).status,200);assert.equal(s.fulfilled(),1);s=setup({change:{status:'pending'}});assert.equal((await(await s.handler(req({action:'verify',reference:ref}))).json()).verified,false);assert.equal(s.fulfilled(),0);s=setup({dbFails:true});assert.equal((await s.handler(req({action:'verify',reference:ref}))).status,503)});
