export interface PaystackCheckoutOptions {
  publicKey: string;
  email: string;
  amountGhs: number;
  currency?: string;
  planInterval: 'monthly' | 'yearly';
  userId: string;
  onReferenceCreated: (reference: string) => void;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

interface PaystackHandler {
  openIframe: () => void;
}

interface PaystackPopGlobal {
  setup: (config: Record<string, unknown>) => PaystackHandler;
}

declare global {
  interface Window {
    PaystackPop?: PaystackPopGlobal;
  }
}

function ensurePaystackScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.PaystackPop) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="js.paystack.co/v1/inline.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Could not load Paystack checkout script.')),
        { once: true }
      );
      setTimeout(() => {
        if (window.PaystackPop) resolve();
      }, 800);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Paystack checkout script.'));
    document.head.appendChild(script);
  });
}

export async function openPaystackCheckout(opts: PaystackCheckoutOptions): Promise<void> {
  await ensurePaystackScript();

  if (!window.PaystackPop) {
    throw new Error('Paystack checkout is unavailable right now. Check your internet connection.');
  }

  const ref = `GN-${opts.planInterval.toUpperCase()}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;

  const amountInSubunits = Math.max(100, Math.round(Number(opts.amountGhs) * 100));

  // Persist the reference before Paystack can collect any money.
  opts.onReferenceCreated(ref);

  const handler = window.PaystackPop.setup({
    key: opts.publicKey.trim(),
    email: opts.email.trim(),
    amount: amountInSubunits,
    currency: (opts.currency || 'GHS').toUpperCase(),
    ref,
    channels: ['mobile_money', 'card', 'bank', 'ussd', 'qr'],
    metadata: {
      custom_fields: [
        {
          display_name: 'Platform',
          variable_name: 'platform',
          value: 'Gyidi Nwom',
        },
        {
          display_name: 'Plan',
          variable_name: 'plan_interval',
          value: opts.planInterval,
        },
        {
          display_name: 'User ID',
          variable_name: 'user_id',
          value: opts.userId,
        },
      ],
    },
    callback: (response: { reference?: string }) => {
      opts.onSuccess(response?.reference || ref);
    },
    onClose: () => {
      opts.onClose();
    },
  });

  handler.openIframe();
}
