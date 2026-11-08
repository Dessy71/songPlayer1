import React, { useEffect, useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Loader2,
  Mic2,
  Headphones,
  MapPin,
  Wallet,
  Camera,
  GraduationCap,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSignupArtiste?: boolean;
  forceSignupMode?: boolean;
  promptReason?: string | null;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultSignupArtiste = false,
  forceSignupMode = false,
  promptReason = null,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(
    defaultSignupArtiste || forceSignupMode ? 'signup' : 'signin'
  );
  const [accountType, setAccountType] = useState<'listener' | 'artiste' | 'claim'>(
    defaultSignupArtiste ? 'artiste' : 'listener'
  );

  useEffect(() => {
    if (isOpen) {
      if (defaultSignupArtiste) {
        setMode('signup');
        setAccountType('artiste');
      } else if (forceSignupMode || promptReason) {
        setMode('signup');
        setAccountType('listener');
      }
    }
  }, [isOpen, defaultSignupArtiste, forceSignupMode, promptReason]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [claimCode, setClaimCode] = useState('');

  // Artiste & SACSU specific fields
  const [realName, setRealName] = useState('');
  const [stageName, setStageName] = useState('');
  const [scgZone, setScgZone] = useState('');
  const [scgBranch, setScgBranch] = useState('');
  const [isSacsu, setIsSacsu] = useState(false);
  const [tertiaryInstitution, setTertiaryInstitution] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'momo' | null>(null);
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [momoOperator, setMomoOperator] = useState('');
  const [momoPhoneNumber, setMomoPhoneNumber] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (accountType === 'claim') {
          if (!claimCode.trim()) {
            throw new Error('Please enter the Claim Code sent to you by the Gyidi Nnwom Admin.');
          }
          // Sign up (or sign in if already created) then claim pre-created profile via RPC
          const { error: signUpErr } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                role: 'listener',
                display_name: email.split('@')[0],
              },
            },
          });
          if (signUpErr) {
            // If email already exists, try signing in with the provided password and then claiming
            const { error: fallbackSignInErr } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (fallbackSignInErr) throw signUpErr;
          }

          const { error: claimErr } = await supabase.rpc('claim_precreated_profile_by_code', {
            p_claim_code: claimCode.trim(),
          });
          if (claimErr) throw claimErr;
        } else {
          if (accountType === 'artiste') {
            if (!realName.trim() || !stageName.trim()) {
              throw new Error('Please fill in your Real Name and Stage / Fellowship Name.');
            }
            if (isSacsu) {
              if (!tertiaryInstitution.trim()) {
                throw new Error('Please enter your Tertiary Institution for SACSU.');
              }
            } else if (!scgZone.trim() || !scgBranch.trim()) {
              throw new Error('Please fill in your SCG Zone and SCG Branch.');
            }
          }

          const cleanUsername =
            (accountType === 'artiste' ? stageName : displayName)
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_') +
            '_' +
            Math.floor(100 + Math.random() * 900);

          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                role: accountType,
                username: cleanUsername,
                display_name:
                  accountType === 'artiste'
                    ? stageName.trim()
                    : displayName.trim() || email.split('@')[0],
                real_name: accountType === 'artiste' ? realName.trim() : null,
                stage_name: accountType === 'artiste' ? stageName.trim() : null,
                scg_zone: accountType === 'artiste' ? scgZone.trim() || null : null,
                scg_branch: accountType === 'artiste' ? scgBranch.trim() || null : null,
                is_sacsu: accountType === 'artiste' ? isSacsu : false,
                tertiary_institution:
                  accountType === 'artiste' && tertiaryInstitution.trim()
                    ? tertiaryInstitution.trim()
                    : null,
              },
            },
          });
          if (signUpErr) throw signUpErr;

          if (avatarFile && signUpData.user) {
            const ext = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase();
            const avatarPath = `avatars/${signUpData.user.id}-${Date.now()}.${ext}`;
            const { error: avErr } = await supabase.storage
              .from('covers')
              .upload(avatarPath, avatarFile, { cacheControl: '31536000', upsert: true });
            if (!avErr) {
              const { data: pub } = supabase.storage.from('covers').getPublicUrl(avatarPath);
              await supabase
                .from('profiles')
                .update({ avatar_url: pub.publicUrl })
                .or(`id.eq.${signUpData.user.id},claimed_user_id.eq.${signUpData.user.id}`);
            }
          }

          // Save payout details to the restricted payout table (service_role only)
          if (paymentMethod && (bankName.trim() || bankAccountNumber.trim() || bankAccountName.trim() || momoOperator.trim() || momoPhoneNumber.trim())) {
            const { error: bankErr } = await supabase.rpc('artiste_set_payout_details', {
              p_payment_method: paymentMethod,
              p_bank_name: bankName.trim(),
              p_bank_account_number: bankAccountNumber.trim(),
              p_bank_account_name: bankAccountName.trim(),
              p_momo_operator: momoOperator.trim(),
              p_momo_phone_number: momoPhoneNumber.trim(),
            });
            if (bankErr) throw bankErr;
          }
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) throw signInErr;
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <img
            src="/logo-mark.png"
            alt="Gyidi Nnwom"
            className="h-11 w-11 rounded-xl object-cover border border-white/10"
          />
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold text-white">
              {mode === 'signup' ? 'Create Your Free Account' : 'Sign In to Gyidi Nnwom'}
            </h2>
            <p className="text-xs text-zinc-400">
              Unlock all songs, likes, downloads, playlists & player controls
            </p>
          </div>
        </div>

        {promptReason && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3.5 py-2.5 text-xs font-semibold text-amber-200">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>{promptReason}</span>
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 rounded-xl bg-zinc-950 p-1 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setAccountType(defaultSignupArtiste ? 'artiste' : 'listener');
              setError(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
              mode === 'signup'
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
              mode === 'signin'
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('listener')}
                aria-pressed={accountType === 'listener'}
                className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                  accountType === 'listener'
                    ? 'border-amber-400 bg-amber-500/15 text-white'
                    : 'border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                <Headphones className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-xs font-bold">Listener</p>
                  <p className="text-[10px] text-zinc-400">Listen & explore</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('artiste')}
                aria-pressed={accountType !== 'listener'}
                className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                  accountType !== 'listener'
                    ? 'border-pink-400 bg-pink-500/15 text-white'
                    : 'border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                <Mic2 className="w-4 h-4 text-pink-400" />
                <div>
                  <p className="text-xs font-bold">New Artiste</p>
                  <p className="text-[10px] text-zinc-400">SCG / SACSU</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'signup' && accountType === 'listener' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Display Name *</label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Akosua Mensah"
                  required
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 pl-10 pr-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:border-amber-400 cursor-pointer transition">
                  <Camera className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="truncate">
                    {avatarFile ? `Photo: ${avatarFile.name}` : 'Add Profile Picture (Optional)'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {mode === 'signup' && accountType === 'artiste' && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/60 p-3.5">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2">
                <label className="flex items-center gap-2 text-xs font-bold text-cyan-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSacsu}
                    onChange={(e) => setIsSacsu(e.target.checked)}
                    className="rounded accent-cyan-400"
                  />
                  <GraduationCap className="w-4 h-4 flex-shrink-0" />
                  <span>SACSU (Tertiary Students&apos; Faction)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Real Full Name / Leader *
                  </label>
                  <input
                    type="text"
                    required
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    placeholder="e.g. Seth Boateng"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Stage / Choir / SACSU Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    placeholder={isSacsu ? 'e.g. KNUST SACSU Choir' : 'e.g. Obogu Seth'}
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {isSacsu && (
                <div>
                  <label className="block text-[11px] font-medium text-cyan-300 mb-1">
                    <GraduationCap className="w-3.5 h-3.5 inline mr-1" />
                    Tertiary Institution *
                  </label>
                  <input
                    type="text"
                    required
                    value={tertiaryInstitution}
                    onChange={(e) => setTertiaryInstitution(e.target.value)}
                    placeholder="e.g. KNUST, University of Ghana (Legon), UCC, UEW, UENR..."
                    className="w-full rounded-xl border border-cyan-500/30 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    <MapPin className="w-3 h-3 inline mr-1 text-amber-400" />
                    SCG Zone {isSacsu ? '(Optional)' : '*'}
                  </label>
                  <input
                    type="text"
                    required={!isSacsu}
                    value={scgZone}
                    onChange={(e) => setScgZone(e.target.value)}
                    placeholder="e.g. Obogu Zone, Ashanti Zone"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    SCG Branch {isSacsu ? '(Optional)' : '*'}
                  </label>
                  <input
                    type="text"
                    required={!isSacsu}
                    value={scgBranch}
                    onChange={(e) => setScgBranch(e.target.value)}
                    placeholder="e.g. Obogu Branch"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:border-amber-400 cursor-pointer transition">
                  <Camera className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="truncate">
                    {avatarFile ? `Photo: ${avatarFile.name}` : 'Upload Artiste Profile Picture'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  <Wallet className="w-3.5 h-3.5 inline mr-1" />
                  Fan Support
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">
                  Payout details are no longer collected here. Once your profile is approved,
                  an administrator configures your Paystack payment page so listeners can
                  support you securely — and your payout details stay private.
                </p>
              </div>
            </div>
          )}

          {/* Payout Details - Artiste signup only */}
          {mode === 'signup' && accountType === 'artiste' && (
            <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3 space-y-3">
              <label className="block text-xs font-bold text-zinc-300 mb-2">Payout Method</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={paymentMethod === 'bank'}
                    onChange={() => setPaymentMethod('bank')}
                    className="rounded accent-amber-400"
                  />
                  <span className="text-xs font-medium text-zinc-200">Bank Account</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={paymentMethod === 'momo'}
                    onChange={() => setPaymentMethod('momo')}
                    className="rounded accent-emerald-400"
                  />
                  <span className="text-xs font-medium text-zinc-200">Mobile Money</span>
                </label>
              </div>

              {paymentMethod === 'bank' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1">Bank *</label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Select a bank</option>
                      <option value="GCB Bank">GCB Bank</option>
                      <option value="Ecobank Ghana">Ecobank Ghana</option>
                      <option value="Fidelity Bank">Fidelity Bank</option>
                      <option value="Absa Bank Ghana">Absa Bank Ghana</option>
                      <option value="Stanbic Bank Ghana">Stanbic Bank Ghana</option>
                      <option value="Standard Chartered Bank Ghana">Standard Chartered Bank Ghana</option>
                      <option value="Societe Generale Ghana">Societe Generale Ghana</option>
                      <option value="Zenith Bank Ghana">Zenith Bank Ghana</option>
                      <option value="Access Bank Ghana">Access Bank Ghana</option>
                      <option value="UBA Ghana">UBA Ghana</option>
                      <option value="Cal Bank">Cal Bank</option>
                      <option value="Republic Bank (HFC)">Republic Bank (HFC)</option>
                      <option value="Prudential Bank">Prudential Bank</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1">Account Number *</label>
                    <input
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="e.g. 1234567890"
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1">Account Name *</label>
                    <input
                      type="text"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="e.g. Seth Boateng"
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'momo' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1">MoMo Operator *</label>
                    <select
                      value={momoOperator}
                      onChange={(e) => setMomoOperator(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">Select an operator</option>
                      <option value="MTN">MTN Mobile Money</option>
                      <option value="Telecel">Telecel Cash</option>
                      <option value="AT">AT Money</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1">Phone Number *</label>
                    <input
                      type="text"
                      value={momoPhoneNumber}
                      onChange={(e) => setMomoPhoneNumber(e.target.value)}
                      placeholder="e.g. 024XXXXXXX"
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1">Account Name *</label>
                    <input
                      type="text"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="e.g. Seth Boateng"
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'signup' && accountType === 'artiste' && (
            <section aria-label="Existing artiste profile" className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
              <h3 className="text-sm font-bold text-emerald-300">Have a Pre-Created Profile Claim Code?</h3>
              <p className="text-xs text-zinc-300">If Admin already created your artiste profile, claim it instead of creating a duplicate.</p>
              <button type="button" onClick={() => { setAccountType('claim'); setError(null); }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950">
                <KeyRound className="h-4 w-4" /> Claim Profile
              </button>
            </section>
          )}

          {mode === 'signup' && accountType === 'claim' && (
            <div className="space-y-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
              <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" />
                Claim Your Pre-Created Artiste Profile
              </p>
              <button type="button" onClick={() => { setAccountType('artiste'); setError(null); }}
                className="min-h-11 text-xs font-bold text-amber-300 hover:underline">← Create a new artiste profile instead</button>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Already have songs on Gyidi Nnwom (e.g. Obogu Seth, Yaw Baidoo, Osiem Choir)? Enter
                the <strong>Claim Code</strong> provided by the Admin plus your preferred login
                email & password below.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-emerald-200 mb-1">
                  Admin Claim Code *
                </label>
                <input
                  type="text"
                  required
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GN-OBOGU-B15A"
                  className="w-full rounded-xl border border-emerald-400/40 bg-zinc-950 px-3.5 py-2 text-sm font-mono font-bold tracking-wider text-emerald-300 placeholder-zinc-600 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-white/10 bg-zinc-950 pl-10 pr-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
                required
                className="w-full rounded-xl border border-white/10 bg-zinc-950 pl-10 pr-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 hover:opacity-95 disabled:opacity-60 transition cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin'
              ? 'Sign In'
              : accountType === 'claim'
              ? 'Claim Pre-Created Artiste Profile'
              : accountType === 'artiste'
              ? isSacsu
                ? 'Create SACSU Artiste Profile'
                : 'Create SCG Artiste Profile'
              : 'Create Free Listener Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
