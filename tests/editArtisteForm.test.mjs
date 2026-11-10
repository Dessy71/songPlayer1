import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import * as esbuild from 'esbuild';

/**
 * Regression cover for the artiste editor wiping itself while you type.
 *
 * The form re-synced from its props on every render, and `artiste` is an
 * object that several call sites rebuild on each render - the admin dashboard
 * refreshes its whole profile list, and a background clock ticks every few
 * seconds. So any of those threw away whatever had been typed.
 *
 * A second, quieter bug lived in the same effect: it re-seeded every field
 * except `paymentMethod`, so a stale payout method could survive a record
 * change and then be saved back to the database. Covered at the bottom.
 *
 * These tests render the real component and drive it the way a browser does.
 */

// --- DOM -------------------------------------------------------------------

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
});

// React's scheduler wants a clock; a real rAF loop would keep the process
// alive after the tests finish.
dom.window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
dom.window.cancelAnimationFrame = (id) => clearTimeout(id);

const assign = (key, value) => {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
};

assign('window', dom.window);
assign('document', dom.window.document);
for (const key of [
  'navigator', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent',
  'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  assign(key, dom.window[key]);
}
assign('IS_REACT_ACT_ENVIRONMENT', true);

// --- Bundle the harness ----------------------------------------------------

const cacheDir = path.join(process.cwd(), 'node_modules', '.cache', 'gyidi-tests');
fs.mkdirSync(cacheDir, { recursive: true });
const bundlePath = path.join(cacheDir, `edit-artiste-${process.pid}.mjs`);

const built = await esbuild.build({
  entryPoints: ['tests/fixtures/EditArtisteHarness.tsx'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  define: { 'import.meta.env': '{}' },
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
});
fs.writeFileSync(bundlePath, built.outputFiles[0].text);

const Harness = (await import(bundlePath)).default;
const React = (await import('react')).default;
const { useState } = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');

// --- Fixtures --------------------------------------------------------------

const ARTISTE_A = '11111111-1111-4111-8111-111111111111';
const ARTISTE_B = '22222222-2222-4222-8222-222222222222';

const makeArtiste = (overrides = {}) => ({
  id: ARTISTE_A,
  role: 'artiste',
  real_name: 'Seth Boateng',
  stage_name: 'Obogu Seth',
  display_name: 'Obogu Seth',
  scg_zone: 'Obogu Zone',
  scg_branch: 'Obogu Branch',
  is_sacsu: false,
  tertiary_institution: 'KNUST',
  bio: 'Gospel minister from Obogu.',
  payment_method: 'bank',
  bank_name: 'GCB',
  bank_account_number: '1234567890',
  bank_account_name: 'Seth Boateng',
  momo_operator: 'MTN',
  momo_phone_number: '0240000000',
  avatar_url: '',
  email: 'seth@example.com',
  ...overrides,
});

// --- Mount -----------------------------------------------------------------

// The parent owns the re-render, exactly as App does, so changing what the
// modal is editing is a real prop change rather than a state nudge.
const props = { current: { artiste: makeArtiste(), isOpen: true } };
let forceParentRender = () => {};

const Parent = () => {
  const [, setTick] = useState(0);
  forceParentRender = () => setTick((t) => t + 1);
  return React.createElement(Harness, props.current);
};

const container = document.getElementById('root');
const root = createRoot(container);
await act(async () => {
  root.render(React.createElement(Parent));
});

after(async () => {
  await act(async () => {
    root.unmount();
  });
  dom.window.close();
  // esbuild keeps a service child process alive, which would hang the suite.
  await esbuild.stop();
  fs.rmSync(bundlePath, { force: true });
});

// --- Helpers ---------------------------------------------------------------

const byPlaceholder = (ph) => container.querySelector(`[placeholder="${ph}"]`);
const stageInput = () => byPlaceholder('e.g. Obogu Seth / KNUST SACSU');
const bioInput = () => byPlaceholder('About this artiste, choir, or SACSU fellowship...');

const inputSetter = Object.getOwnPropertyDescriptor(
  dom.window.HTMLInputElement.prototype,
  'value'
).set;
const textareaSetter = Object.getOwnPropertyDescriptor(
  dom.window.HTMLTextAreaElement.prototype,
  'value'
).set;

const setInput = async (input, value, setter = inputSetter) => {
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

/** Types one character at a time, the way a person does. */
const type = async (input, text) => {
  for (const char of text) {
    await setInput(input, input.value + char);
  }
};

const rerender = async () => {
  await act(async () => {
    forceParentRender();
  });
};

const show = async (next) => {
  props.current = { ...props.current, ...next };
  await rerender();
};

/** The payout radios carry no value attribute, so find them by their label. */
const radioFor = (labelText) => {
  const label = [...container.querySelectorAll('label')].find((el) =>
    (el.textContent || '').includes(labelText)
  );
  return label ? label.querySelector('input[type="radio"]') : null;
};

// --- Loading ---------------------------------------------------------------

test('the form loads the artiste being edited', () => {
  assert.equal(stageInput().value, 'Obogu Seth');
  assert.equal(bioInput().value, 'Gospel minister from Obogu.');
});

test('each keystroke sticks instead of reverting on the next', async () => {
  await setInput(stageInput(), '');
  await type(stageInput(), 'Awurade');
  assert.equal(stageInput().value, 'Awurade');
});

// --- The regression --------------------------------------------------------

test('typing survives a parent re-render', async () => {
  await setInput(stageInput(), 'Obogu Seth (Live)');
  await rerender();
  assert.equal(stageInput().value, 'Obogu Seth (Live)');
});

test('a background refresh that swaps in new profile data does not clobber edits', async () => {
  await setInput(stageInput(), 'Edited Name');

  // A profile refresh replacing every object was the exact moment edits used
  // to disappear.
  await show({ artiste: makeArtiste({ stage_name: 'Whatever the database says' }) });

  assert.equal(stageInput().value, 'Edited Name');
});

test('the bio survives a parent re-render', async () => {
  await setInput(bioInput(), 'Rewritten bio', textareaSetter);
  await rerender();
  assert.equal(bioInput().value, 'Rewritten bio');
});

test('switching to a different artiste still loads that artiste', async () => {
  await show({
    artiste: makeArtiste({ id: ARTISTE_B, stage_name: 'Second Artiste', bio: 'Second bio' }),
  });
  assert.equal(stageInput().value, 'Second Artiste');
  assert.equal(bioInput().value, 'Second bio');
});

test('the payment method follows the record instead of going stale', async () => {
  await show({ artiste: makeArtiste({ id: ARTISTE_A, payment_method: 'bank' }) });
  assert.equal(radioFor('Bank Account').checked, true, 'A uses a bank account');
  assert.equal(radioFor('Mobile Money').checked, false);

  await show({
    artiste: makeArtiste({ id: ARTISTE_B, stage_name: 'Second Artiste', payment_method: 'momo' }),
  });
  assert.equal(radioFor('Mobile Money').checked, true, 'B uses mobile money');
  assert.equal(
    radioFor('Bank Account').checked,
    false,
    "A's bank selection must not leak onto B and get saved"
  );
});

test('closing and reopening discards edits from a cancelled attempt', async () => {
  await show({ artiste: makeArtiste(), isOpen: true });
  await setInput(stageInput(), 'Abandoned edit');

  await show({ isOpen: false });
  await show({ isOpen: true });

  assert.equal(stageInput().value, 'Obogu Seth');
});
