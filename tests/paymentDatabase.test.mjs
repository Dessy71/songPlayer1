import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL engine, isolated from production users/payments.
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('test.role',true) $$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE profiles(id uuid PRIMARY KEY, claimed_user_id uuid, role text DEFAULT 'listener',is_precreated boolean DEFAULT false,created_at timestamptz DEFAULT now(),email text,is_premium boolean DEFAULT false,premium_plan text,premium_until timestamptz,last_payment_reference text);
CREATE TABLE premium_subscriptions(id uuid DEFAULT gen_random_uuid(),user_id uuid,profile_id uuid,user_email text,plan_interval text,amount_ghs numeric,currency text,paystack_reference text UNIQUE,paystack_status text,payment_channel text,starts_at timestamptz,expires_at timestamptz);
CREATE TABLE verified_premium_payments(reference text PRIMARY KEY,user_id uuid,plan_interval text,amount_subunits bigint);
CREATE FUNCTION activate_premium_subscription(text,text,text) RETURNS profiles LANGUAGE sql AS $$ SELECT * FROM profiles LIMIT 1 $$;
CREATE TABLE favorites(user_id uuid); CREATE TABLE playlists(user_id uuid); CREATE TABLE playlist_songs(user_id uuid); CREATE TABLE offline_library(user_id uuid); CREATE TABLE daily_verse_flyers(id int);
`);
await db.exec(fs.readFileSync('supabase/migrations/202611060002_central_payment_recovery.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/202611060003_require_paid_entitlement.sql','utf8'));
const uid='11111111-1111-4111-8111-111111111111';
await db.exec(`SET test.role='service_role'; INSERT INTO auth.users VALUES('${uid}'); INSERT INTO profiles(id) VALUES('${uid}');`);
async function order(ref,plan='monthly') { await db.query(`INSERT INTO premium_payment_orders(reference,user_id,plan_interval,amount_subunits,customer_email) VALUES($1,$2,$3,500,'member@example.com')`,[ref,uid,plan]); }
async function fulfill(ref,id,paid=new Date().toISOString()) { return (await db.query(`SELECT * FROM fulfill_verified_premium_payment($1,$2,'CUS_test',$3,'mobile_money')`,[ref,id,paid])).rows[0]; }

test('duplicate and concurrent callback/webhook attempts create one receipt and one term',async()=>{
 await order('GN-first');
 const results=await Promise.all([fulfill('GN-first','1'),fulfill('GN-first','1'),fulfill('GN-first','1')]);
 assert.equal(results[0].premium_until.toISOString(),results[2].premium_until.toISOString());
 assert.equal((await db.query('SELECT count(*)::int AS n FROM premium_subscriptions')).rows[0].n,1);
 assert.equal((await db.query("SELECT status FROM premium_payment_orders WHERE reference='GN-first'")).rows[0].status,'verified');
});
test('renewal extends term exactly once and yearly expiry uses calendar year',async()=>{
 const before=(await db.query('SELECT premium_until FROM profiles')).rows[0].premium_until;
 await order('GN-renew','yearly');
 const result=await fulfill('GN-renew','2');
 const expected=(await db.query("SELECT $1::timestamptz + interval '1 year' AS expiry",[before.toISOString()])).rows[0].expiry;
 assert.equal(result.premium_until.toISOString(),expected.toISOString());
 assert.equal((await fulfill('GN-renew','2')).premium_until.toISOString(),expected.toISOString());
});
test('same Paystack transaction cannot activate a second reference; failure rolls back',async()=>{
 await order('GN-reused');
 await assert.rejects(fulfill('GN-reused','2'),/unique/);
 assert.equal((await db.query("SELECT status FROM premium_payment_orders WHERE reference='GN-reused'")).rows[0].status,'pending');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM premium_subscriptions')).rows[0].n,2);
});
test('expired and unverified profiles fail the server-side entitlement function',async()=>{
 await db.exec(`SET test.uid='${uid}'; UPDATE profiles SET premium_until=now()-interval '1 second';`);
 assert.equal((await db.query('SELECT has_active_premium() AS active')).rows[0].active,false);
 await db.exec("UPDATE profiles SET premium_until=now()+interval '1 day',is_premium=false;");
 assert.equal((await db.query('SELECT has_active_premium() AS active')).rows[0].active,false);
});
test('untrusted profile insert cannot self-grant Premium',async()=>{
 const other='22222222-2222-4222-8222-222222222222';
 await db.exec(`SET test.role='authenticated'; INSERT INTO profiles(id,is_premium,premium_plan) VALUES('${other}',true,'lifetime');`);
 assert.equal((await db.query('SELECT is_premium FROM profiles WHERE id=$1',[other])).rows[0].is_premium,false);
});
test('authenticated roles cannot call fulfillment, insert orders or use old activation RPC',async()=>{
 const rows=(await db.query(`SELECT has_function_privilege('authenticated','fulfill_verified_premium_payment(text,text,text,timestamptz,text)','EXECUTE') AS fulfill,has_function_privilege('authenticated','activate_premium_subscription(text,text,text)','EXECUTE') AS old,has_table_privilege('authenticated','premium_payment_orders','INSERT') AS orders`)).rows[0];
 assert.deepEqual(rows,{fulfill:false,old:false,orders:false});
});

test('central order recovery is account-scoped under RLS, independent of browser state',async()=>{
 await db.exec(`SET ROLE authenticated; SET test.uid='${uid}';`);
 assert.ok((await db.query('SELECT reference FROM premium_payment_orders')).rows.length>0);
 await db.exec("SET test.uid='22222222-2222-4222-8222-222222222222';");
 assert.equal((await db.query('SELECT reference FROM premium_payment_orders')).rows.length,0);
 await db.exec('RESET ROLE;');
});

test('unverified profile flag without a central paid receipt cannot unlock database access',async()=>{
 const other='22222222-2222-4222-8222-222222222222';
 await db.exec(`SET test.uid='${other}'; UPDATE profiles SET is_premium=true,premium_plan='monthly',premium_until=now()+interval '1 day' WHERE id='${other}';`);
 assert.equal((await db.query('SELECT has_active_premium() AS active')).rows[0].active,false);
});

test('delayed historical payment expires from paid date; month-end uses calendar arithmetic',async()=>{
 const other='33333333-3333-4333-8333-333333333333';
 await db.exec(`SET test.role='service_role'; INSERT INTO auth.users VALUES('${other}'); INSERT INTO profiles(id) VALUES('${other}');`);
 await db.query("INSERT INTO premium_payment_orders(reference,user_id,plan_interval,amount_subunits,customer_email) VALUES('GN-delayed',$1,'monthly',500,'member@example.com')",[other]);
 const profile=await fulfill('GN-delayed','historic-id','2024-01-31T12:00:00Z');
 assert.equal(profile.premium_until.toISOString(),'2024-02-29T12:00:00.000Z');
 assert.equal(profile.is_premium,false);
});
