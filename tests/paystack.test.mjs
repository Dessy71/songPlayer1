import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('reference is saved before setup and opening checkout, even if success never fires', async () => {
  const events = [];
  let config;
  let saved;
  const context = vm.createContext({ window: { PaystackPop: {
    setup: value => { events.push('setup'); config = value; assert.equal(saved, value.ref); return { openIframe: () => events.push('open') }; },
  }}});
  const source = ts.transpileModule(fs.readFileSync('src/lib/paystack.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => { throw new Error('Unexpected import'); });
  await module.evaluate();
  await module.namespace.openPaystackCheckout({ publicKey: 'pk_test_example', email: 'member@example.com', amountGhs: 5, planInterval: 'monthly', userId: 'user-a',
    onReferenceCreated: reference => { saved = reference; events.push('persist'); },
    onSuccess: reference => { assert.equal(reference, saved); events.push('success'); }, onClose: () => {},
  });
  assert.deepEqual(events, ['persist', 'setup', 'open']);
  assert.match(saved, /^GN-MONTHLY-/);
  config.callback({});
  assert.deepEqual(events, ['persist', 'setup', 'open', 'success']);
});
