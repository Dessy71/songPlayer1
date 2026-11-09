import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = vm.createContext({
  Response,
  Request,
  URL,
  AbortSignal,
  fetch,
  console,
  Deno: { serve() {}, env: { get() {} } },
});

/** Load the edge function without deploying it. */
async function loadModule() {
  const source = ts.transpileModule(
    fs.readFileSync('supabase/functions/delete-account/index.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  const m = new vm.SourceTextModule(source, { context });
  const dep = new vm.SyntheticModule(['createClient'], function () {
    this.setExport('createClient', () => {});
  }, { context });
  await m.link(() => dep);
  await m.evaluate();
  return m.namespace;
}

/** A minimal stand-in for the supabase-js client the handler drives. */
function makeAdmin({ deleteRequestedAt = null, tables = {} } = {}) {
  const calls = [];
  const chain = (table) => ({
    update: (payload) => ({
      or: async (filter) => {
        calls.push({ op: 'update', table, payload, filter });
        return { error: tables[table]?.updateError ?? null };
      },
    }),
    delete: () => ({
      eq: async (column, value) => {
        calls.push({ op: 'delete', table, column, value });
        return { error: tables[table]?.deleteError ?? null };
      },
    }),
  });
  return {
    calls,
    client: {
      from: (table) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'user-1', delete_requested_at: deleteRequestedAt, avatar_url: null },
              error: null,
            }),
          }),
        }),
        ...chain(table),
      }),
      auth: {
        admin: {
          deleteUser: async (uid) => {
            calls.push({ op: 'deleteUser', uid });
            return { error: null };
          },
        },
      },
    },
  };
}

/**
 * One client object has to serve both roles - the handler calls the factory
 * twice but the tests point it at the same fake - so auth must expose both
 * the user-facing getUser and the admin deleteUser.
 */
function makeHandler({ deleteRequestedAt = null, tables = {}, sessionOk = true } = {}) {
  const { calls, client } = makeAdmin({ deleteRequestedAt, tables });
  client.auth.getUser = async () =>
    sessionOk
      ? { data: { user: { id: 'user-1' } }, error: null }
      : { data: { user: null }, error: { message: 'expired' } };
  return { calls, client };
}

const envOk = (key) =>
  ({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_ANON_KEY: 'a' })[key];

const post = (action, headers = { Authorization: 'Bearer t' }) =>
  new Request('https://x/f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ action }),
  });

test('deletion cannot be finalised before the recovery window closes', async () => {
  const { createDeleteAccountHandler } = await loadModule();
  const { calls, client } = makeHandler({ deleteRequestedAt: new Date().toISOString() });
  const fn = createDeleteAccountHandler(envOk, () => client);

  const res = await fn(post('finalise'));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /recovery window/i);
  assert.ok(body.due_at, 'the caller is told when it becomes due');
  assert.ok(!calls.some((c) => c.op === 'deleteUser'), 'nothing is deleted yet');
});

test('a finalise with nothing scheduled is refused', async () => {
  const { createDeleteAccountHandler } = await loadModule();
  const { client } = makeHandler({ deleteRequestedAt: null });
  const fn = createDeleteAccountHandler(envOk, () => client);

  const res = await fn(post('finalise'));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not been scheduled/i);
});

test('finalising orphans published work instead of destroying it', async () => {
  const { createDeleteAccountHandler } = await loadModule();
  // Requested 31 days ago, so the window has passed.
  const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const { calls, client } = makeHandler({ deleteRequestedAt: past });
  const fn = createDeleteAccountHandler(envOk, () => client);

  const res = await fn(post('finalise'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.deleted, true);

  // Songs and albums are unlinked, never deleted.
  for (const table of ['songs', 'albums']) {
    const update = calls.find((c) => c.op === 'update' && c.table === table);
    assert.ok(update, `${table} should be orphaned`);
    assert.equal(update.payload.artiste_id, null);
    assert.equal(update.payload.uploaded_by, null);
    assert.ok(!calls.some((c) => c.op === 'delete' && c.table === table), `${table} must not be deleted`);
  }
  assert.ok(calls.some((c) => c.op === 'deleteUser'), 'the auth credential is removed');
});

test('no request proceeds without a valid session', async () => {
  const { createDeleteAccountHandler } = await loadModule();
  const { client } = makeHandler({ sessionOk: false });
  const fn = createDeleteAccountHandler(envOk, () => client);

  assert.equal((await fn(post('schedule'))).status, 401);
  assert.equal((await fn(post('finalise'))).status, 401);
});

test('an unconfigured function fails loudly rather than silently', async () => {
  const { createDeleteAccountHandler } = await loadModule();
  const { client } = makeHandler();
  const fn = createDeleteAccountHandler(() => undefined, () => client);

  const res = await fn(post('schedule'));
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /not configured/i);
});

test('a missing table does not strand the rest of the deletion', async () => {
  const { createDeleteAccountHandler } = await loadModule();
  const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const { calls, client } = makeHandler({
    deleteRequestedAt: past,
    tables: { live_stream_waitlist: { deleteError: { message: 'relation "live_stream_waitlist" does not exist' } } },
  });
  const fn = createDeleteAccountHandler(envOk, () => client);

  const res = await fn(post('finalise'));
  const body = await res.json();
  assert.equal(body.ok, true, 'a missing optional table is not a failure');
  assert.ok(calls.some((c) => c.op === 'deleteUser'), 'deletion still completes');
});
