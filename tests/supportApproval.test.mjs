import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

async function loadMusicTypes() {
  const source = ts.transpileModule(fs.readFileSync('src/types/music.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = vm.createContext({});
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => {
    throw new Error('Unexpected import');
  });
  await module.evaluate();
  return module.namespace;
}

test('legacy MoMo numbers are never treated as a Paystack payment page', async () => {
  const { isPaystackPageUrl } = await loadMusicTypes();

  // Real values currently stored by legacy rows.
  assert.equal(isPaystackPageUrl('0542442084'), false);
  assert.equal(isPaystackPageUrl('0557394159'), false);
  assert.equal(isPaystackPageUrl(' georgina adoma sarfo '), false);
  assert.equal(isPaystackPageUrl(''), false);
  assert.equal(isPaystackPageUrl(null), false);
  assert.equal(isPaystackPageUrl(undefined), false);

  // Only genuine Paystack hosts count, and look-alike hosts must not pass.
  assert.equal(isPaystackPageUrl('https://paystack.shop/pay/kbadu'), true);
  assert.equal(isPaystackPageUrl('https://paystack.com/pay/abc'), true);
  assert.equal(isPaystackPageUrl('https://paystack.com/pay/abc?x=1'), true);
  assert.equal(isPaystackPageUrl('  https://paystack.shop/pay/kbadu  '), true);
  assert.equal(isPaystackPageUrl('https://evil-paystack.com/pay/x'), false);
  assert.equal(isPaystackPageUrl('https://paystack.com.evil.io/pay/x'), false);
  assert.equal(isPaystackPageUrl('http://paystack.shop/pay/x'), false);
});

test('support badge requires approval AND a real Paystack page', async () => {
  const { hasApprovedSupportPage } = await loadMusicTypes();

  const approved = { approval_status: 'approved' };
  const pending = { approval_status: 'pending' };
  const withPage = { has_paystack_page: true };
  const noPage = { has_paystack_page: false };

  // Payout details now come from the redacted summary, never from the profile.
  assert.equal(hasApprovedSupportPage(approved, noPage), false);
  assert.equal(hasApprovedSupportPage(approved, null), false);

  // Not approved yet -> no badge even when a valid page exists.
  assert.equal(hasApprovedSupportPage(pending, withPage), false);

  // Approved + real page -> badge.
  assert.equal(hasApprovedSupportPage(approved, withPage), true);

  // Grandfathered rows (no status) count as approved.
  assert.equal(hasApprovedSupportPage({ approval_status: undefined }, withPage), true);
  assert.equal(hasApprovedSupportPage(null, withPage), false);
});

test('grandfathered rows without a status stay visible, rejected ones do not', async () => {
  const { isProfileApproved } = await loadMusicTypes();

  // Rows created before the approval column existed must not disappear.
  assert.equal(isProfileApproved({ approval_status: undefined }), true);
  assert.equal(isProfileApproved({ approval_status: 'approved' }), true);
  assert.equal(isProfileApproved({ approval_status: 'pending' }), false);
  assert.equal(isProfileApproved({ approval_status: 'rejected' }), false);
  assert.equal(isProfileApproved(null), false);
});

test('public profile type carries no payout fields', () => {
  const source = fs.readFileSync('src/types/music.ts', 'utf8');
  const profileBlock = source.slice(
    source.indexOf('export interface UserProfile'),
    source.indexOf('export interface ProfileClaimCode')
  );
  for (const field of ['support_number', 'support_account_name', 'support_provider']) {
    assert.equal(
      profileBlock.includes(field),
      false,
      `${field} must not be on the publicly readable UserProfile`
    );
  }
});

test('signup and artiste studio stop collecting payout details', () => {
  for (const file of ['src/components/AuthModal.tsx', 'src/components/ArtisteStudioView.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    for (const field of ['support_number:', 'support_account_name:', 'support_provider:']) {
      assert.equal(
        source.includes(field),
        false,
        `${file} must not write ${field}`
      );
    }
  }
});
