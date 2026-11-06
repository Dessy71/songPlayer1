import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const authorization = req.headers.get('Authorization') || '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Sign in required' }, 401);
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secret) return json({ error: 'Payment verification is not configured. Contact the administrator with your payment reference.' }, 503);
    const { reference, plan } = await req.json();
    if (typeof reference !== 'string' || !/^[a-zA-Z0-9_-]{4,150}$/.test(reference) || !['monthly', 'yearly'].includes(plan)) return json({ error: 'Invalid payment details' }, 400);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: settings, error: settingsError } = await admin.from('platform_settings').select('premium_monthly_price_ghs,premium_yearly_price_ghs').eq('id', 'global').single();
    if (settingsError) throw settingsError;
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
    const verified = await response.json();
    const payment = verified.data;
    const fields = payment?.metadata?.custom_fields || [];
    const field = (name: string) => fields.find((item: { variable_name: string }) => item.variable_name === name)?.value;
    const expected = Math.round(Number(plan === 'yearly' ? settings.premium_yearly_price_ghs : settings.premium_monthly_price_ghs) * 100);
    if (!response.ok || !verified.status || payment?.status !== 'success' || payment.currency !== 'GHS' || payment.reference !== reference || payment.amount !== expected || expected <= 0 || field('user_id') !== user.id || field('plan_interval') !== plan || payment.customer?.email?.toLowerCase() !== user.email?.toLowerCase()) return json({ error: 'Payment could not be verified for this account, plan, and amount.' }, 400);
    const { data: existing } = await admin.from('premium_subscriptions').select('profile_id,user_id').eq('paystack_reference', reference).maybeSingle();
    if (existing) {
      if (existing.user_id !== user.id) return json({ error: 'Payment already used' }, 409);
      const { data, error } = await admin.from('profiles').select('*').eq('id', existing.profile_id).single();
      if (error) throw error;
      return json(data);
    }
    const { error: receiptError } = await admin.from('verified_premium_payments').upsert({ reference, user_id: user.id, plan_interval: plan, amount_subunits: payment.amount });
    if (receiptError) throw receiptError;
    const { data, error } = await userClient.rpc('activate_premium_subscription', { p_plan_interval: plan, p_reference: reference, p_channel: payment.channel || 'paystack' });
    if (error) throw error;
    return json(data);
  } catch (error) {
    console.error('Premium verification failed', error);
    return json({ error: 'Unable to activate membership. Keep your payment reference and contact support; do not pay again.' }, 500);
  }
});
