import React, { useState } from 'react';
import { X, HeartHandshake, Copy, Check, Wallet, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, ApprovalStatus } from '../types/music';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  artiste: UserProfile; // Support Gyidi or specific Artiste
  isAdminViewer?: boolean;
  onApproved?: (profile: UserProfile) => void; // Callback for approval after Paystack setup
}

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  artiste,
  isAdminViewer = false,
  onApproved,
}) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({ ...artiste });
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSupportBadge, setShowSupportBadge] = useState(!!artiste.support_number && !!artiste.support_account_name);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent, approve: boolean = false) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    // Validation for Admin Approval: Must have Paystack URL and Subaccount Code
    if (approve && isAdminViewer) {
      if (!formData.support_number || !formData.support_account_name) {
        setError('Admin must input Paystack Payment Page URL and Subaccount Code before approval.');
        setIsSaving(false);
        return;
      }
    }

    // Map Paystack fields to support_number and support_account_name
    const updateData: Partial<UserProfile> = { ...formData };
    if (approve) {
      updateData.approval_status = 'approved';
      // Optional: set approved_by/at if backend handles it, or just status here
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', artiste.id)
      .select('*')
      .single();

    if (error) {
      setError(error.message);
    } else {
      const savedProfile = data as UserProfile;
      if (approve && onApproved) {
        onApproved(savedProfile);
      }
      onClose();
    }
    setIsSaving(false);
  };

  if (!isOpen) return null;

  // Determine provider display
  const isPaystack = formData.support_provider?.toLowerCase().includes('paystack') || false;
  const displayUrl = isPaystack ? formData.support_number : formData.support_number || 'N/A';
  const displaySubaccount = isPaystack ? formData.support_account_name : '';

  // Support Badge Logic: Only profile pictures (avatar_url) shown if approved and details exist
  const hasSupportBadge = formData.approval_status === 'approved' && showSupportBadge;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          {hasSupportBadge && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          )}
          <h3 className="text-lg font-bold text-white">Support Details: {artiste.display_name || artiste.email}</h3>
          {hasSupportBadge && <ShieldCheck className="w-4 h-4 text-emerald-400 ml-2" title="Approved Support Badge" />}
        </div>

        {/* ADMIN-ONLY PAYSTACK FIELDS & APPROVAL */}
        {isAdminViewer && (
          <div className="space-y-4 p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl mb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase mb-2">
              <AlertCircle className="w-3 h-3" />
              Admin Paystack Configuration & Approval (Support Gyidi / Artiste)
            </div>
            <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                  Paystack Payment Page URL <span className="text-[10px] text-amber-400">(Mapped to support_number)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.support_number || ''}
                    onChange={(e) => setFormData({ ...formData, support_number: e.target.value })}
                    className="w-full bg-zinc-800/50 border border-amber-400/20 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-400 pr-10"
                    placeholder="https://paystack.com/pay/..."
                  />
                  <button
                    type="button"
                    onClick={() => formData.support_number && handleCopy(formData.support_number)}
                    disabled={!formData.support_number}
                    className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-amber-400 disabled:opacity-30 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                    Subaccount Code <span className="text-[10px] text-amber-400">(Mapped to support_account_name)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.support_account_name || ''}
                      onChange={(e) => setFormData({ ...formData, support_account_name: e.target.value })}
                      className="w-full bg-zinc-800/50 border border-amber-400/20 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-400 pr-10"
                      placeholder="SUB-xxxxxxxxxxxx"
                    />
                    <button
                      type="button"
                      onClick={() => formData.support_account_name && handleCopy(formData.support_account_name)}
                      disabled={!formData.support_account_name}
                      className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-amber-400 disabled:opacity-30 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                    Support Provider <span className="text-[10px] text-amber-400">(e.g., Paystack Payment Page, MTN Mobile Money)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.support_provider || 'Paystack Payment Page'}
                    onChange={(e) => setFormData({ ...formData, support_provider: e.target.value })}
                    className="w-full bg-zinc-800/50 border border-amber-400/20 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm font-bold text-zinc-200 hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-amber-400 text-zinc-950 rounded-lg text-sm font-bold hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  {artiste.approval_status !== 'approved' && (
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, true)}
                      disabled={isSaving}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Approving...' : 'Approve & Activate Support'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* STANDARD VIEW (Non-Admin) */}
          {!isAdminViewer && (
            <div className="space-y-3 mt-4">
              {hasSupportBadge ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 overflow-hidden">
                      {artiste.avatar_url ? (
                        <img src={artiste.avatar_url} alt="Artiste" className="h-full w-full object-cover" />
                      ) : (
                        <Wallet className="w-5 h-5" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Support {artiste.display_name || 'Artiste'}
                    </span>
                  </div>
                  
                  <div className="relative group cursor-pointer" onClick={() => window.open(displayUrl, '_blank')}>
                    <div className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 pr-10 flex items-center justify-between">
                      <span>{isPaystack ? 'Paystack Payment Page' : formData.support_provider}</span>
                      <span className="text-emerald-400 font-bold">{displayUrl ? 'Click to Support' : 'N/A'}</span>
                    </div>
                    {displayUrl && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleCopy(displayUrl); }}
                        className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-emerald-400 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {isPaystack && displaySubaccount && (
                    <div className="mt-1 text-[10px] text-zinc-400 font-mono">
                      Subaccount: {displaySubaccount}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-zinc-400 italic">
                  {artiste.approval_status === 'pending' 
                    ? 'Profile pending admin approval and Paystack setup.' 
                    : 'Support details not configured.'}
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
