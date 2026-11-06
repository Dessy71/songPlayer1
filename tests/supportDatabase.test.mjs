import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const artist='93fdfca2-aa25-4e6f-ab40-5092a6dbc5c7',uid='11111111-1111-4111-8111-111111111111';
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;CREATE TABLE profiles(id uuid PRIMARY KEY,claimed_user_id uuid,display_name text,username text,avatar_url text);INSERT INTO profiles(id)VALUES('${artist}');INSERT INTO auth.users VALUES('${uid}');INSERT INTO profiles(id,display_name)VALUES('${uid}','Test listener');`);
await db.exec(fs.readFileSync('supabase/migrations/202611060004_support_checkout.sql','utf8'));
async function order(ref,visible=false){await db.query(`INSERT INTO support_payment_orders(reference,user_id,artiste_id,amount_subunits,customer_email,subaccount_code,domain,publicly_visible)VALUES($1,$2,$3,500,'test@example.com','ACCT_test','test',$4)`,[ref,uid,artist,visible]);}
const fulfill=(ref,id)=>db.query('SELECT fulfill_verified_support($1,$2,now())',[ref,id]);
test('receipt is idempotent and same provider transaction cannot support two orders',async()=>{
 await order('one',true);await fulfill('one','123');await fulfill('one','123');await order('two');await assert.rejects(fulfill('two','123'),/unique/);
 assert.equal((await db.query("SELECT status FROM support_payment_orders WHERE reference='two'")).rows[0].status,'pending');
 await assert.rejects(fulfill('one','999'),/mismatch/);
});
test('public recognition excludes unverified and anonymous supporters',async()=>{
 await db.exec("UPDATE support_payment_orders SET publicly_visible=false");
 assert.equal((await db.query('SELECT * FROM artiste_supporters($1)',[artist])).rows.length,0);
 await db.exec("UPDATE support_payment_orders SET publicly_visible=true WHERE reference='one'");
 const rows=(await db.query('SELECT * FROM artiste_supporters($1)',[artist])).rows;assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]).sort(),['avatar_url','display_name']);
});
test('browsers cannot change payment configuration or mint receipts',async()=>{
 const r=(await db.query("SELECT has_table_privilege('authenticated','support_checkout_config','UPDATE') AS config,has_table_privilege('authenticated','support_payment_orders','INSERT') AS orders,has_function_privilege('authenticated','fulfill_verified_support(text,text,timestamptz)','EXECUTE') AS fulfill")).rows[0];assert.deepEqual(r,{config:false,orders:false,fulfill:false});
});
test('order reads are account scoped under RLS',async()=>{
 await db.exec(`GRANT USAGE ON SCHEMA auth TO authenticated;SET ROLE authenticated;SET test.uid='22222222-2222-4222-8222-222222222222'`);
 assert.equal((await db.query('SELECT * FROM support_payment_orders')).rows.length,0);
 await db.exec(`SET test.uid='${uid}'`);assert.equal((await db.query('SELECT * FROM support_payment_orders')).rows.length,2);await db.exec('RESET ROLE');
});
