/** Pure server-side payment contract. Not a browser callback or badge issuer.
 * Orders and split codes MUST come from trusted server storage, never request metadata.
 * This module is intentionally not wired to production until the support ledger,
 * admin approval and webhook routing have been deployed together.
 */
export interface SupportOrder {
  reference: string;
  userId: string;
  artisteId: string | null;
  amountSubunits: number;
  email: string;
  splitCode: string | null;
  domain: 'test' | 'live';
}

function assertOrder(order: SupportOrder) {
  if (!/^GN-SUPPORT-[a-zA-Z0-9-]{16,100}$/.test(order.reference) ||
      !order.userId || !order.email ||
      !Number.isSafeInteger(order.amountSubunits) || order.amountSubunits < 100 ||
      !['test', 'live'].includes(order.domain) ||
      (order.artisteId !== null && (!order.artisteId || !order.splitCode)) ||
      (order.splitCode !== null && !/^SPL_[a-zA-Z0-9]+$/.test(order.splitCode))) {
    throw new Error('Invalid trusted support order');
  }
}

export function supportCheckoutPayload(order: SupportOrder) {
  assertOrder(order);
  return {
    reference: order.reference,
    email: order.email,
    amount: String(order.amountSubunits),
    currency: 'GHS',
    channels: ['card', 'mobile_money'],
    ...(order.splitCode ? { split_code: order.splitCode } : {}),
    metadata: JSON.stringify({
      purpose: 'artiste_support', user_id: order.userId,
      artiste_id: order.artisteId, support_reference: order.reference,
    }),
  };
}

/** Call ONLY with the result of an authenticated server-to-server Paystack verify
 * request, never with the webhook payload or browser-supplied payment fields.
 * Caller must then commit a unique receipt atomically before awarding a badge.
 */
export function assertVerifiedSupport(payment: any, order: SupportOrder, now = Date.now()) {
  assertOrder(order);
  let metadata;
  try { metadata = typeof payment?.metadata === 'string' ? JSON.parse(payment.metadata) : payment?.metadata; }
  catch { throw new Error('Invalid support metadata'); }
  const paidAt = Date.parse(payment?.paid_at);
  const transactionId = payment?.id;
  const validId = (typeof transactionId === 'string' && /^[1-9][0-9]*$/.test(transactionId)) ||
    (typeof transactionId === 'number' && Number.isSafeInteger(transactionId) && transactionId > 0);
  if (!payment || payment.status !== 'success' || payment.reference !== order.reference ||
      payment.currency !== 'GHS' || payment.domain !== order.domain ||
      !Number.isSafeInteger(payment.amount) || payment.amount !== order.amountSubunits ||
      !validId || !Number.isFinite(paidAt) || paidAt > now + 300000 ||
      metadata?.purpose !== 'artiste_support' || metadata?.user_id !== order.userId ||
      metadata?.artiste_id !== order.artisteId || metadata?.support_reference !== order.reference ||
      payment.customer?.email?.toLowerCase() !== order.email.toLowerCase() ||
      (order.splitCode !== null && payment.split?.split_code !== order.splitCode)) {
    throw new Error('Support payment does not match its trusted order');
  }
  return { transactionId: String(transactionId), paidAt: new Date(paidAt).toISOString() };
}
