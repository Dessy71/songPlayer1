import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = vm.createContext({ Response, Request, URL, AbortSignal, fetch, console, Deno: { serve() {}, env: { get() {} } } });
const source = ts.transpileModule(fs.readFileSync('supabase/functions/app-analytics/index.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const m = new vm.SourceTextModule(source, { context });
const dep = new vm.SyntheticModule(['createClient'], function () {
  this.setExport('createClient', () => {});
}, { context });
await m.link(() => dep);
await m.evaluate();

const { classifyDevice } = m.namespace;

test('phones and tablets are separated from desktops', () => {
  assert.equal(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)').device_type, 'mobile');
  assert.equal(classifyDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile').device_type, 'mobile');
  assert.equal(classifyDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)').device_type, 'tablet');
  assert.equal(classifyDevice('Mozilla/5.0 (Linux; Android 11; Lenovo) Tablet').device_type, 'tablet');
  assert.equal(classifyDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)').device_type, 'desktop');
  assert.equal(classifyDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)').device_type, 'desktop');
});

test('operating systems are identified', () => {
  assert.equal(classifyDevice('Mozilla/5.0 (Windows NT 10.0)').os, 'Windows');
  assert.equal(classifyDevice('Mozilla/5.0 (Linux; Android 14) Mobile').os, 'Android');
  assert.equal(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)').os, 'iOS');
  assert.equal(classifyDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)').os, 'macOS');
});

test('browsers are identified, most specific match winning', () => {
  // Edg and OPR both advertise Chrome, so order matters.
  assert.equal(classifyDevice('Mozilla/5.0 Chrome/120 Edg/120').browser, 'Edge');
  assert.equal(classifyDevice('Mozilla/5.0 Chrome/120 OPR/106').browser, 'Opera');
  assert.equal(classifyDevice('Mozilla/5.0 Firefox/121').browser, 'Firefox');
  assert.equal(classifyDevice('Mozilla/5.0 Chrome/120 Safari/537').browser, 'Chrome');
  assert.equal(classifyDevice('Mozilla/5.0 Version/17 Safari/605').browser, 'Safari');
});

test('a missing or empty user agent degrades instead of throwing', () => {
  for (const ua of ['', undefined, null]) {
    const result = classifyDevice(ua);
    assert.equal(result.device_type, 'desktop');
    assert.equal(result.os, 'Unknown');
    assert.equal(result.browser, 'Unknown');
  }
});
