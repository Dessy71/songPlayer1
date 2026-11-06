import { supabase } from './supabase';
import { UserProfile } from '../types/music';

export type PremiumPlan = 'monthly' | 'yearly';
export interface PendingPayment { reference: string; plan: PremiumPlan }
const key = (userId: string) => `gyidi_pending_payment_${userId}`;

export function rememberPayment(userId: string, payment: PendingPayment | null) {
  try {
    if (payment) localStorage.setItem(key(userId), JSON.stringify(payment));
    else localStorage.removeItem(key(userId));
  } catch { /* Manual reference recovery remains available if storage is blocked. */ }
}

export function pendingPayment(userId: string): PendingPayment | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(userId)) || 'null');
    return value && typeof value.reference === 'string' && ['monthly', 'yearly'].includes(value.plan) ? value : null;
  } catch { return null; }
}

async function invoke(body: object) {
  // The Supabase client refreshes expiring sessions before invoking the verifier.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in to verify your payment.');
  const { data, error } = await supabase.functions.invoke('verify-premium-payment', { body });
  if (error) {
    let message = 'Payment verification is unavailable. Keep your reference and retry verification; do not pay again.';
    if (error.context instanceof Response) {
      try {
        const details = await error.context.clone().json();
        if (typeof details.error === 'string') message = details.error;
      } catch { /* Keep actionable fallback for gateway/network errors. */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function checkPaymentReadiness() {
  const data = await invoke({ action: 'readiness' });
  if (data?.ready !== true) throw new Error('Payment verification is not ready. Checkout was not opened.');
}

export async function verifyPremiumPayment(payment: PendingPayment): Promise<UserProfile> {
  const data = await invoke(payment);
  if (!data?.id || data.is_premium !== true || !data.premium_until || !(Date.parse(data.premium_until) > Date.now())) {
    throw new Error('Payment verification did not return an active membership. Keep your reference and retry verification, not payment.');
  }
  return data as UserProfile;
}
