import React, { useState } from 'react';
import {
  X,
  KeyRound,
  Mail,
  Lock,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { createIsolatedAuthClient, supabase } from '../lib/supabase';
import { UserProfile } from '../types/music';

interface ProvisionArtisteLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  artiste: UserProfile | null;
  claimCode?: string | null;
  onProvisioned: () => Promise<void>;
}

function makeSuggestedPassword(stageName?: string | null): string {
  const base = (stageName || 'Gyidi')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${base || 'Gyidi'}#${rand}!`;
}

export const ProvisionArtisteLoginModal: React.FC<ProvisionArtisteLoginModalProps> = ({
  isOpen,
  onClose,
  artiste,
  claimCode,
  onProvisioned,
}) => {
  const [email, setEmail] = useState(artiste?.email || '');
  const [password, setPassword] = useState(() => makeSuggestedPassword(artiste?.stage_name));
  const [currentCode, setCurrentCode] = useState(claimCode || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(
    null
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && artiste) {
      setEmail(artiste.email || '');
      setPassword(makeSuggestedPassword(artiste.stage_name));
      setCurrentCode(claimCode || '');
      setError(null);
      setCreatedCreds(null);
    }
  }, [isOpen, artiste, claimCode]);

  if (!isOpen || !artiste) return null;

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2400);
  };

  const handleCreateDirectCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Step 1: Pre-assign email to this pre-created profile via Admin RPC
      const { error: assignErr } = await supabase.rpc('assign_profile_to_email', {
        p_profile_id: artiste.id,
        p_target_email: cleanEmail,
      });
      if (assignErr) throw assignErr;

      // Step 2: Provision actual GoTrue user with isolated client (keeps Admin logged in!)
      const isolated = createIsolatedAuthClient();
      const { error: signUpErr } = await isolated.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            role: 'artiste',
            display_name: artiste.stage_name || artiste.display_name || 'Artiste',
            stage_name: artiste.stage_name || null,
          },
        },
      });

      if (signUpErr && !signUpErr.message.toLowerCase().includes('already registered')) {
        throw signUpErr;
      }

      // Ensure link is finalized if user already existed
      await supabase.rpc('assign_profile_to_email', {
        p_profile_id: artiste.id,
        p_target_email: cleanEmail,
      });

      setCreatedCreds({ email: cleanEmail, password });
      await onProvisioned();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create login credentials.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateClaimCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('regenerate_profile_claim_code', {
        p_profile_id: artiste.id,
      });
      if (rpcErr) throw rpcErr;
      if (data) setCurrentCode(String(data));
      await onProvisioned();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not regenerate claim code.');
    } finally {
      setBusy(false);
    }
  };

  const inviteCodeMessage = `Hello ${
    artiste.stage_name || 'Artiste'
  }! Your verified Artiste profile and songs are live on Gyidi Nnwom (${
    window.location.origin
  }).\n\nTo log in & manage your songs/analytics:\n1. Click "Create Account" → select "Claim Profile"\n2. Enter Claim Code: ${currentCode}\n3. Choose your Email & Password!`;

  const directCredsMessage = createdCreds
    ? `Hello ${
        artiste.stage_name || 'Artiste'
      }! Your verified Artiste account on Gyidi Nnwom (${
        window.location.origin
      }) is ready.\n\nSign In Credentials:\nEmail: ${createdCreds.email}\nPassword: ${
        createdCreds.password
      }\n\n(You can change your password anytime inside Artiste Studio.)`
    : '';

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-3xl border border-white/15 bg-zinc-950 p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-5">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 px-3 py-1 text-[11px] font-bold text-amber-300">
            <KeyRound className="w-3.5 h-3.5" />
            Pre-Created Profile Access
          </span>
          <h3 className="text-lg font-extrabold text-white mt-2">
            Login Credentials for {artiste.stage_name || artiste.display_name}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Give this Artiste access either by creating ready-made Email + Password credentials OR
            by sending their Secret Claim Code.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Option 1: Direct Email + Password Creation */}
        <form
          onSubmit={handleCreateDirectCredentials}
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              Option 1: Create Ready-Made Login (Email + Password)
            </h4>
          </div>

          <p className="text-[11px] text-zinc-300">
            Create an immediate login so the Artiste simply clicks <strong>Sign In</strong> with
            this Email and Password (they can change their password later in Artiste Studio).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                Artiste Login Email *
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. oboguseth@gmail.com"
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 pl-9 pr-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-300">Temporary Password *</label>
                <button
                  type="button"
                  onClick={() => setPassword(makeSuggestedPassword(artiste.stage_name))}
                  className="text-[10px] font-bold text-emerald-300 hover:underline cursor-pointer"
                >
                  Generate
                </button>
              </div>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 pl-9 pr-3 py-2 text-xs font-mono text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2.5 text-xs font-extrabold text-zinc-950 cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Create & Link Login Credentials
          </button>

          {createdCreds && (
            <div className="rounded-xl border border-emerald-400/50 bg-zinc-950 p-3.5 space-y-2">
              <p className="text-xs font-extrabold text-emerald-300">
                ✓ Login Ready! Send these credentials to {artiste.stage_name}:
              </p>
              <div className="text-xs font-mono text-zinc-200 space-y-0.5 bg-zinc-900 rounded-lg p-2.5">
                <p>
                  Email: <strong className="text-white">{createdCreds.email}</strong>
                </p>
                <p>
                  Password: <strong className="text-amber-300">{createdCreds.password}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyText('creds', directCredsMessage)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
              >
                {copiedKey === 'creds' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied WhatsApp Message!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Credentials for WhatsApp / SMS
                  </>
                )}
              </button>
            </div>
          )}
        </form>

        {/* Option 2: Self-Service Secret Claim Code */}
        {!artiste.claimed_user_id && (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" />
                Option 2: Secret Claim Code (Artiste Picks Own Email & Password)
              </h4>
              <button
                type="button"
                disabled={busy}
                onClick={handleRegenerateClaimCode}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-300 hover:text-white cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                New Code
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5">
              <span className="text-sm font-mono font-extrabold tracking-widest text-amber-300">
                {currentCode || 'Click "New Code" to generate'}
              </span>
              {currentCode && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyText('code', currentCode)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/15 cursor-pointer"
                  >
                    {copiedKey === 'code' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Code
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => copyText('invite', inviteCodeMessage)}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-extrabold text-zinc-950 hover:bg-amber-400 cursor-pointer"
                  >
                    {copiedKey === 'invite' ? 'Invite Copied!' : 'Copy WhatsApp Invite'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
