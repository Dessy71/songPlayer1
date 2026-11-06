import { createClient } from 'npm:@supabase/supabase-js@2';

// One verifier for authenticated callbacks, recovery and signed webhooks.
// Deploy with verify_jwt=false: webhook requests have no Supabase JWT. Every
// non-webhook request is authenticated explicitly below with auth.getUser().
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
class PaymentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const validReference = (reference: unknown): reference is string => typeof reference === 'string' && /^[a-zA-Z0-9_.=-]{4,150}$/.test(reference);

export async function validSignature(raw: Uint8Array, signature: string, secret: string): Promise<boolean> {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, raw));
  let diff = 0;
  for (let i = 0; i < digest.length; i++) diff |= digest[i] ^ parseInt(signature.slice(i * 2, i * 2 + 2), 16);
  return diff === 0;
}

export function assertVerifiedPayment(payment: any, reference: string, order: any) {
  if (!payment || payment.status !== 'success' || payment.reference !== reference ||
      payment.currency !== order.currency || !Number.isSafeInteger(payment.amount) ||
      payment.amount !== Number(order.amount_subunits) || !payment.id ||
      !payment.paid_at || !Number.isFinite(Date.parse(payment.paid_at)) ||
      Date.parse(payment.paid_at) > Date.now() + 300000 ||
      payment.customer?.email?.toLowerCase() !== order.customer_email.toLowerCase()) {
    throw new PaymentError('Payment is not verified for this account, currency and amount. Do not pay again unless you cancelled or payment failed.');
  }
  const metadata = typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : payment.metadata;
  const fields = metadata?.custom_fields || [];
  const owner = metadata?.user_id || fields.find((v: any) => v.variable_name === 'user_id')?.value;
  const plan = metadata?.plan_interval || fields.find((v: any) => v.variable_name === 'plan_interval')?.value;
  if (owner !== order.user_id || plan !== order.plan_interval) throw new PaymentError('Payment account or plan mismatch.');
}

export function createHandler(env: (key: string) => string | undefined, clientFactory = createClient, request = fetch) {
  return async (req: Request): Promise<Response> => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
    const webhook = new URL(req.url).searchParams.get('webhook') === '1';
    try {
      const url = env('SUPABASE_URL')!;
      const secret = env('PAYSTACK_SECRET_KEY');
      if (!secret) throw new PaymentError('Payment verification is not configured. Contact support; do not pay again.', 503);
      const admin = clientFactory(url, env('SUPABASE_SERVICE_ROLE_KEY')!);
      const paystack = async (path: string, body?: object) => {
        let response: Response;
        try {
          response = await request(`https://api.paystack.co/${path}`, {
            method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(12000),
            headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
        } catch { throw new PaymentError('Payment provider is temporarily unavailable. Retry checking your payment, not paying again.', 503); }
        const result = await response.json();
        if (!response.ok || !result.status) throw new PaymentError('Paystack could not confirm this transaction. Retry checking your payment later.', response.status >= 500 ? 503 : 400);
        return result.data;
      };
      const profileFor = async (uid: string) => {
        const { data, error } = await admin.from('profiles').select('*').or(`id.eq.${uid},claimed_user_id.eq.${uid}`);
        if (error) throw error;
        const profile = data?.find((p: any) => p.role === 'admin') || data?.find((p: any) => p.claimed_user_id === uid && p.is_precreated) || data?.find((p: any) => p.role === 'artiste') || data?.[0];
        if (!profile) throw new PaymentError('Account profile missing. Contact support.', 409);
        return profile;
      };
      const verify = async (reference: string, expectedUser?: string, allowLegacy = false) => {
        if (!validReference(reference)) throw new PaymentError('Invalid payment reference.');
        const { data: stored, error: orderError } = await admin.from('premium_payment_orders').select('*').eq('reference', reference).maybeSingle();
        if (orderError) throw orderError;
        if (stored && expectedUser && stored.user_id !== expectedUser) throw new PaymentError('Payment not found for this account.', 404);
        if (!stored && !allowLegacy) throw new PaymentError('Payment order not found.', 404);
        const payment = await paystack(`transaction/verify/${encodeURIComponent(reference)}`);
        let order = stored;
        if (!order) {
          // Backward compatibility: verify historical Inline payments using their
          // account metadata and current configured price. Never trust webhook data.
          const metadata = typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : payment.metadata;
          const field = (name: string) => metadata?.[name] || metadata?.custom_fields?.find((v: any) => v.variable_name === name)?.value;
          const uid = field('user_id'), plan = field('plan_interval');
          if (!/^[a-f0-9-]{36}$/i.test(uid || '') || !['monthly', 'yearly'].includes(plan) || (expectedUser && uid !== expectedUser)) throw new PaymentError('No matching account payment.', 404);
          const { data: { user }, error: userError } = await admin.auth.admin.getUserById(uid);
          if (userError || !user?.email) throw new PaymentError('Payment account not found.', 404);
          const { data: settings, error } = await admin.from('platform_settings').select('premium_monthly_price_ghs,premium_yearly_price_ghs').eq('id', 'global').single();
          if (error) throw error;
          order = { reference, user_id: uid, plan_interval: plan, amount_subunits: Math.round(Number(plan === 'yearly' ? settings.premium_yearly_price_ghs : settings.premium_monthly_price_ghs) * 100), currency: 'GHS', customer_email: user.email };
          assertVerifiedPayment(payment, reference, order);
          const { error: insertError } = await admin.from('premium_payment_orders').upsert(order, { onConflict: 'reference', ignoreDuplicates: true });
          if (insertError) throw insertError;
        }
        assertVerifiedPayment(payment, reference, order);
        const { data, error } = await admin.rpc('fulfill_verified_premium_payment', {
          p_reference: reference, p_transaction_id: String(payment.id),
          p_customer_code: payment.customer?.customer_code || null,
          p_paid_at: payment.paid_at, p_channel: payment.channel || 'paystack',
        });
        if (error) throw error;
        return data;
      };
      if (webhook) {
        // Signature must cover the exact raw bytes, before JSON parsing.
        const raw = new Uint8Array(await req.arrayBuffer());
        if (raw.byteLength > 262144) throw new PaymentError('Payload too large.', 413);
        if (!await validSignature(raw, req.headers.get('x-paystack-signature') || '', secret)) throw new PaymentError('Invalid signature.', 401);
        const event = JSON.parse(new TextDecoder().decode(raw));
        if (event.event !== 'charge.success') return json({ received: true, ignored: true });
        // The only authoritative fields come from Paystack's verify API.
        try { await verify(event.data?.reference, undefined, true); }
        catch (error) {
          if (error instanceof PaymentError && error.status === 404) return json({ received: true, ignored: true }); // unrelated merchant transactions
          throw error;
        }
        // Never acknowledge a failed DB write: non-2xx causes Paystack to retry.
        return json({ received: true });
      }
      const userClient = clientFactory(url, env('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) throw new PaymentError('Please sign in to your payment account.', 401);
      const body = await req.json();
      if (body.action === 'readiness') return json({ ready: true });
      if (body.action === 'initialize') {
        if (!['monthly', 'yearly'].includes(body.plan) || !user.email) throw new PaymentError('Invalid plan or missing account email.');
        await profileFor(user.id);
        const { data: settings, error } = await admin.from('platform_settings').select('premium_enabled,premium_monthly_price_ghs,premium_yearly_price_ghs').eq('id', 'global').single();
        if (error) throw error;
        if (settings.premium_enabled === false) throw new PaymentError('New Premium checkouts are paused. Existing payment recovery is still available.', 503);
        const amount = Math.round(Number(body.plan === 'yearly' ? settings.premium_yearly_price_ghs : settings.premium_monthly_price_ghs) * 100);
        if (!Number.isSafeInteger(amount) || amount < 100) throw new PaymentError('Invalid configured subscription price.', 503);
        // A unique server reference
        // binds account, plan and the immutable price snapshot before any charge.
        const { count, error: countError } = await admin.from('premium_payment_orders').select('reference', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(Date.now() - 600000).toISOString());
        if (countError) throw countError;
        if ((count || 0) >= 5) throw new PaymentError('Too many checkout attempts. Check existing payments or wait ten minutes.', 429);
        const reference = `GN-${crypto.randomUUID()}`;
        const { error: insertError } = await admin.from('premium_payment_orders').insert({ reference, user_id: user.id, plan_interval: body.plan, amount_subunits: amount, currency: 'GHS', customer_email: user.email });
        if (insertError) throw insertError;
        const initialized = await paystack('transaction/initialize', {
          reference, email: user.email, amount, currency: 'GHS',
          callback_url: `${env('PAYMENT_APP_URL') || 'https://gyidi-nwom.vercel.app'}/?payment_return=1`,
          metadata: { user_id: user.id, plan_interval: body.plan }, channels: ['mobile_money', 'card'],
        });
        const { error: updateError } = await admin.from('premium_payment_orders').update({ status: 'initialized' }).eq('reference', reference).eq('status', 'pending');
        if (updateError) throw updateError;
        return json({ reference, authorization_url: initialized.authorization_url });
      }
      if (body.action === 'recover') {
        const { data: orders, error } = await admin.from('premium_payment_orders').select('reference').eq('user_id', user.id).neq('status', 'verified').order('created_at', { ascending: false }).limit(10);
        if (error) throw error;
        let pending = 0;
        // Bound provider traffic; webhook processing is independent of this fallback.
        await Promise.all((orders || []).map(async ({ reference }: any) => {
          try { await verify(reference, user.id); } catch { pending++; }
        }));
        return json({ profile: await profileFor(user.id), pending });
      }
      return json(await verify(body.reference, user.id, true));
    } catch (error) {
      // Do not log secrets, authorization codes or full provider/customer payloads.
      console.error('Premium processing failed', error instanceof PaymentError ? error.message : 'Database/provider operation failed');
      const status = error instanceof PaymentError ? error.status : 500;
      return json({ error: error instanceof PaymentError ? error.message : 'Payment activation is temporarily unavailable. Retry checking your payment; do not pay again.' }, status);
    }
  };
}

Deno.serve(createHandler((key) => Deno.env.get(key)));
