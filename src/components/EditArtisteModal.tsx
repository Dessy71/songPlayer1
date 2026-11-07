import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Save,
  Loader2,
  GraduationCap,
  MapPin,
  Mail,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types/music';

interface EditArtisteModalProps {
  isOpen: boolean;
  onClose: () => void;
  artiste: UserProfile | null; // null = create new pre-created Artiste / SACSU profile (Admin)
  isAdminViewer: boolean;
  onSaved?: (saved: UserProfile) => void;
}

export const EditArtisteModal: React.FC<EditArtisteModalProps> = ({
  isOpen,
  onClose,
  artiste,
  isAdminViewer,
  onSaved,
}) => {
  const isCreating = !artiste;

  const [realName, setRealName] = useState(artiste?.real_name || '');
  const [stageName, setStageName] = useState(artiste?.stage_name || artiste?.display_name || '');
  const [scgZone, setScgZone] = useState(artiste?.scg_zone || '');
  const [scgBranch, setScgBranch] = useState(artiste?.scg_branch || '');
  const [isSacsu, setIsSacsu] = useState(Boolean(artiste?.is_sacsu));
  const [tertiaryInstitution, setTertiaryInstitution] = useState(
    artiste?.tertiary_institution || ''
  );
  const [bio, setBio] = useState(artiste?.bio || '');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'momo' | null>(artiste?.payment_method || null);
  const [bankName, setBankName] = useState(artiste?.bank_name || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(artiste?.bank_account_number || '');
  const [momoOperator, setMomoOperator] = useState(artiste?.momo_operator || '');
  const [momoPhoneNumber, setMomoPhoneNumber] = useState(artiste?.momo_phone_number || '');
  const [bankAccountName, setBankAccountName] = useState(artiste?.bank_account_name || '');

  const [avatarUrl, setAvatarUrl] = useState(artiste?.avatar_url || '');
  const [assignEmail, setAssignEmail] = useState(artiste?.email || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && artiste) {
      setRealName(artiste.real_name || '');
      setStageName(artiste.stage_name || artiste.display_name || '');
      setScgZone(artiste.scg_zone || '');
      setScgBranch(artiste.scg_branch || '');
      setIsSacsu(Boolean(artiste.is_sacsu));
      setTertiaryInstitution(artiste.tertiary_institution || '');
      setBio(artiste.bio || '');
      setBankName(artiste.bank_name || '');
      setBankAccountNumber(artiste.bank_account_number || '');
      setBankAccountName(artiste.bank_account_name || '');
      setMomoOperator(artiste.momo_operator || '');
      setMomoPhoneNumber(artiste.momo_phone_number || '');
      setAvatarUrl(artiste.avatar_url || '');
      setAssignEmail(artiste.email || '');
    }
  }, [isOpen, artiste, isAdminViewer]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/artiste-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('covers')
        .upload(path, file, { cacheControl: '31536000', upsert: true });
      if (upErr) throw upErr;
      setAvatarUrl(supabase.storage.from('covers').getPublicUrl(path).data.publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!stageName.trim()) {
      setError('Stage / Choir Name is required.');
      return;
    }
    if (isSacsu && !tertiaryInstitution.trim()) {
      setError('Please enter the Tertiary Institution for this SACSU profile.');
      return;
    }

    setSaving(true);
    try {
      let savedProfile: UserProfile;

      if (isCreating) {
        const cleanUser =
          stageName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_') +
          '_' +
          Math.floor(100 + Math.random() * 900);

        const { data, error: insErr } = await supabase
          .from('profiles')
          .insert({
            username: cleanUser,
            display_name: stageName.trim(),
            stage_name: stageName.trim(),
            real_name: realName.trim() || null,
            role: 'artiste',
            scg_zone: scgZone.trim() || null,
            scg_branch: scgBranch.trim() || null,
            is_sacsu: isSacsu,
            tertiary_institution: tertiaryInstitution.trim() || null,
            bio: bio.trim() || null,
            avatar_url: avatarUrl || null,
            is_precreated: true,
            is_verified_artiste: true,
          })
          .select('*')
          .single();

        if (insErr) throw insErr;
        savedProfile = data as UserProfile;
      } else {
        const { data, error: updErr } = await supabase
          .from('profiles')
          .update({
            display_name: stageName.trim(),
            stage_name: stageName.trim(),
            real_name: realName.trim() || null,
            scg_zone: scgZone.trim() || null,
            scg_branch: scgBranch.trim() || null,
            is_sacsu: isSacsu,
            tertiary_institution: tertiaryInstitution.trim() || null,
            bio: bio.trim() || null,
            avatar_url: avatarUrl || null,
          })
          .eq('id', artiste.id)
          .select('*')
          .single();

        if (updErr) throw updErr;
        savedProfile = data as UserProfile;
      }

      // Optional: if Admin entered an email to link/assign this pre-created profile to an Artiste account
      if (isAdminViewer && assignEmail.trim() && assignEmail.trim() !== (artiste?.email || '')) {
        const { data: linkedData, error: linkErr } = await supabase.rpc('assign_profile_to_email', {
          p_profile_id: savedProfile.id,
          p_target_email: assignEmail.trim(),
        });
        if (linkErr) throw linkErr;
        if (linkedData) savedProfile = linkedData as UserProfile;
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

      onSaved?.(savedProfile);
      setOkMsg('Artiste profile saved!');
      setTimeout(() => {
        setOkMsg(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save Artiste profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-extrabold text-white">
          {isCreating ? 'Create SCG / SACSU Artiste Profile' : `Edit Profile — ${stageName}`}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Update identity, SCG Zone & Branch, SACSU Tertiary Institution, and Fan Support account
          details
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Avatar */}
          <div className="flex items-center gap-3">
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=""
                className="h-14 w-14 rounded-2xl object-cover border border-amber-400/40"
              />
            )}
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:border-amber-400 cursor-pointer">
              <Camera className="w-4 h-4" />
              {avatarUrl ? 'Change Profile Photo' : 'Upload Profile Photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Stage / Choir Name *
              </label>
              <input
                type="text"
                required
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="e.g. Obogu Seth / KNUST SACSU"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Real Name / Leader Name
              </label>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="e.g. Seth Boateng"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SCG Zone & SCG Branch — BOTH Text Inputs! */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                <MapPin className="w-3 h-3 inline mr-1 text-amber-400" />
                SCG Zone
              </label>
              <input
                type="text"
                value={scgZone}
                onChange={(e) => setScgZone(e.target.value)}
                placeholder="e.g. Obogu Zone, Ashanti Zone"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">SCG Branch</label>
              <input
                type="text"
                value={scgBranch}
                onChange={(e) => setScgBranch(e.target.value)}
                placeholder="e.g. Obogu Branch"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SACSU / Tertiary Institution Toggle & Input */}
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 space-y-2.5">
            <label className="flex items-center gap-2 text-xs font-bold text-cyan-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isSacsu}
                onChange={(e) => setIsSacsu(e.target.checked)}
                className="rounded accent-cyan-400"
              />
              <GraduationCap className="w-4 h-4" />
              SACSU (Tertiary Students&apos; Faction of SCG)
            </label>

            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Tertiary Institution {isSacsu ? '*' : '(Optional)'}
              </label>
              <input
                type="text"
                required={isSacsu}
                value={tertiaryInstitution}
                onChange={(e) => setTertiaryInstitution(e.target.value)}
                placeholder="e.g. KNUST, University of Ghana (Legon), UCC, UEW, UENR..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Bio / Ministry Note</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="About this artiste, choir, or SACSU fellowship..."
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Payout Details - Bank or Mobile Money */}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Bank</label>
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
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="e.g. 1234567890"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Account Name</label>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">MoMo Operator</label>
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
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={momoPhoneNumber}
                    onChange={(e) => setMomoPhoneNumber(e.target.value)}
                    placeholder="e.g. 024XXXXXXX"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Account Name</label>
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
          </div>          {/* Admin: Link / Assign Profile to Artiste&apos;s Login Email */}
          {isAdminViewer && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-1.5">
              <label className="block text-xs font-bold text-amber-300">
                <Mail className="w-3.5 h-3.5 inline mr-1" />
                Assign / Link to Artiste&apos;s Login Email (Optional)
              </label>
              <input
                type="email"
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
                placeholder="artiste@email.com — gives them self-service access in Artiste Studio"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {okMsg && (
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              {okMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-600 py-2.5 text-xs font-extrabold text-white shadow-lg cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isCreating ? 'Create Artiste Profile' : 'Save Artiste Details'}
          </button>
        </form>
      </div>
    </div>
  );
};
