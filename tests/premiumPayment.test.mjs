import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

async function harness(result, signedIn = true) {
  const storage = new Map();
  const calls = [];
  const context = vm.createContext({ Response, Date, URL, localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }});
  const mock = new vm.SyntheticModule(['supabase'], function () {
    this.setExport('supabase', {
      auth: { getSession: async () => ({ data: { session: signedIn ? {} : null } }) },
      functions: { invoke: async (name, options) => { calls.push({ name, ...options }); return result; } },
    });
  }, { context });
  const source = ts.transpileModule(fs.readFileSync('src/lib/premiumPayment.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => mock);
  await module.evaluate();
  return { api: module.namespace, calls };
}

test('readiness must pass before checkout can proceed', async () => {
  const { api, calls } = await harness({ data: { ready: true }, error: null });
  await api.checkPaymentReadiness();
  assert.equal(calls[0].body.action, 'readiness');
});

test('non-2xx exposes server configuration error instead of SDK generic message', async () => {
  const { api } = await harness({ error: { context: new Response(JSON.stringify({ error: 'Payment verification is not configured.' }), { status: 503 }) } });
  await assert.rejects(api.checkPaymentReadiness(), /Payment verification is not configured/);
});

test('verification requires a signed-in account and does not invoke when signed out', async () => {
  const { api, calls } = await harness({}, false);
  await assert.rejects(api.verifyPremiumPayment({ reference: 'ref-123', plan: 'monthly' }), /sign in/);
  assert.equal(calls.length, 0);
});

test('free or expired profile cannot trigger a success celebration', async () => {
  for (const data of [{ id: 'u', is_premium: false }, { id: 'u', is_premium: true, premium_until: '2020-01-01' }, { id: 'u', is_premium: true, premium_until: 'invalid' }]) {
    const { api } = await harness({ data, error: null });
    await assert.rejects(api.verifyPremiumPayment({ reference: 'ref-123', plan: 'monthly' }), /active membership/);
  }
});

test('verified active profile is returned to update account state', async () => {
  const profile = { id: 'u', is_premium: true, premium_until: new Date(Date.now() + 86400000).toISOString() };
  const { api } = await harness({ data: profile, error: null });
  assert.equal(await api.verifyPremiumPayment({ reference: 'ref-123', plan: 'monthly' }), profile);
});

test('pending references are account scoped and clear only when requested', async () => {
  const { api } = await harness({});
  api.rememberPayment('user-a', { reference: 'ref-123', plan: 'yearly' });
  assert.equal(api.pendingPayment('user-a').reference, 'ref-123');
  assert.equal(api.pendingPayment('user-b'), null);
  api.rememberPayment('user-a', null);
  assert.equal(api.pendingPayment('user-a'), null);
});

test('cross-device restore needs only the authenticated account, not local payment references',async()=>{
 const profile={id:'u',is_premium:true,premium_until:new Date(Date.now()+86400000).toISOString()};
 const {api,calls}=await harness({data:{profile,pending:0},error:null});
 assert.equal(api.pendingPayment('u'),null);
 assert.equal((await api.recoverPremiumAccount()).profile,profile);
 assert.equal(calls[0].body.action,'recover');
});

test('hosted checkout initialization sends only a plan, never a client amount or account ID',async()=>{
 const checkout={reference:'GN-server-generated',authorization_url:'https://checkout.paystack.com/example'};
 const {api,calls}=await harness({data:checkout,error:null});
 assert.equal(await api.initializePremiumPayment('monthly'),checkout);
 assert.equal(JSON.stringify(calls[0].body),JSON.stringify({action:'initialize',plan:'monthly'}));
});

test('unexpected checkout origins are rejected instead of redirecting customers',async()=>{
 const {api}=await harness({data:{reference:'GN-server',authorization_url:'https://fake.example/charge'},error:null});
 await assert.rejects(api.initializePremiumPayment('monthly'),/Invalid checkout destination/);
});
