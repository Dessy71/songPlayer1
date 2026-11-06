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
  const [supportProvider, setSupportProvider] = useState('MTN Mobile Money (MoMo)');
  const [supportNumber, setSupportNumber] = useState('');
  const [supportAccountName, setSupportAccountName] = useState('');
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
            throw new Error('Please enter the Claim Code sent to you by the Gyidi Nwom Admin.');
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
            if (!supportNumber.trim() || !supportAccountName.trim()) {
              throw new Error('Please provide your fan support account number and account name.');
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
                support_provider: accountType === 'artiste' ? supportProvider : null,
                support_number: accountType === 'artiste' ? supportNumber.trim() : null,
                support_account_name: accountType === 'artiste' ? supportAccountName.trim() : null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
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
            alt="Gyidi Nwom"
            className="h-11 w-11 rounded-xl object-cover border border-white/10"
          />
          <div>
            <h2 className="text-lg font-bold text-white">
              {mode === 'signup' ? 'Create Your Free Account' : 'Sign In to Gyidi Nwom'}
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
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('listener')}
                className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                  accountType === 'listener'
                    ? 'border-amber-400 bg-amber-500/15 text-white'
                    : 'border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                <Headphones className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-xs font-bold">Listener</p>
                  <p className="text-[10px] text-zinc-400">Stream & download</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('artiste')}
                className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                  accountType === 'artiste'
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

              <button
                type="button"
                onClick={() => setAccountType('claim')}
                className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                  accountType === 'claim'
                    ? 'border-emerald-400 bg-emerald-500/15 text-white'
                    : 'border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-xs font-bold">Claim Profile</p>
                  <p className="text-[10px] text-zinc-400">Pre-created code</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'signup' && accountType === 'claim' && (
            <div className="space-y-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
              <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" />
                Claim Your Pre-Created Artiste Profile
              </p>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Already have songs on Gyidi Nwom (e.g. Obogu Seth, Yaw Baidoo, Osiem Choir)? Enter
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

              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 pt-1">
                <Wallet className="w-3.5 h-3.5 inline mr-1" />
                Fan Support Account Details
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={supportProvider}
                  onChange={(e) => setSupportProvider(e.target.value)}
                  className="rounded-xl border border-white/10 bg-zinc-950 px-2.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="MTN Mobile Money (MoMo)">MTN MoMo</option>
                  <option value="Telecel Cash">Telecel Cash</option>
                  <option value="AT Money">AT Money</option>
                  <option value="Bank Account">Bank Account</option>
                </select>
                <input
                  type="text"
                  required
                  value={supportNumber}
                  onChange={(e) => setSupportNumber(e.target.value)}
                  placeholder="Account / MoMo No. *"
                  className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
                <input
                  type="text"
                  required
                  value={supportAccountName}
                  onChange={(e) => setSupportAccountName(e.target.value)}
                  placeholder="Account Name *"
                  className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
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
