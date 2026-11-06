import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('supabase/functions/_shared/supportPayment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const module=new vm.SourceTextModule(source);await module.link(()=>{throw new Error('Unexpected dependency');});await module.evaluate();
const {supportCheckoutPayload,assertVerifiedSupport}=module.namespace;
const order={reference:'GN-SUPPORT-1234567890abcdef',userId:'listener-1',artisteId:'artiste-1',amountSubunits:10000,email:'listener@example.com',splitCode:'SPL_test123',domain:'test'};
const payment={reference:order.reference,status:'success',currency:'GHS',domain:'test',amount:10000,id:123,paid_at:new Date().toISOString(),customer:{email:order.email},split:{split_code:order.splitCode},metadata:JSON.parse(supportCheckoutPayload(order).metadata)};
test('checkout binds exact amount, account, artiste, reference and configured split',()=>{
 const payload=supportCheckoutPayload(order);
 assert.equal(payload.split_code,order.splitCode);assert.equal(payload.amount,'10000');assert.equal(JSON.parse(payload.metadata).user_id,order.userId);
 assert.equal(assertVerifiedSupport(payment,order).transactionId,'123');
});
test('rejects invalid trusted amounts and missing artiste splits',()=>{
 for(const change of [{amountSubunits:NaN},{amountSubunits:0},{amountSubunits:100.5},{splitCode:null},{reference:'client-reference'},{splitCode:'https://paystack.com/pay/test'}]) assert.throws(()=>supportCheckoutPayload({...order,...change}));
});
test('rejects pending payments, wrong amount, currency, reference, environment and split',()=>{
 for(const change of [{status:'pending'},{amount:9999},{currency:'NGN'},{reference:'other'},{domain:'live'},{split:{}},{split:{split_code:'SPL_other'}},{id:0},{id:9007199254740992},{paid_at:'invalid'},{paid_at:'2099-01-01'}]) assert.throws(()=>assertVerifiedSupport({...payment,...change},order));
});
test('rejects forged listener/artiste metadata and email-only attribution',()=>{
 for(const change of [{user_id:'other'},{artiste_id:'other'},{support_reference:'other'},{purpose:'premium'}]) assert.throws(()=>assertVerifiedSupport({...payment,metadata:{...payment.metadata,...change}},order));
 for(const metadata of [null,'{bad','{}']) assert.throws(()=>assertVerifiedSupport({...payment,metadata},order));
 assert.throws(()=>assertVerifiedSupport({...payment,customer:{email:'other@example.com'}},order));
});
test('direct Gyidi support needs no artiste split and large transaction IDs remain strings',()=>{
 const gyidi={...order,artisteId:null,splitCode:null};const payload=supportCheckoutPayload(gyidi);
 assert.equal('split_code' in payload,false);
 assert.equal(assertVerifiedSupport({...payment,id:'9007199254740993',metadata:payload.metadata},gyidi).transactionId,'9007199254740993');
});
