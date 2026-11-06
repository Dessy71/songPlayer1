import React, { useState } from 'react';
import { X, Copy, Check, AlertCircle, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';

import { UserProfile } from '../types/music';

interface SupportModalProps {
  artiste: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  isAdminViewer?: boolean;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  artiste,
  isOpen,
  onClose,
  isAdminViewer = false,
}) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({ ...artiste });
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .update(formData)
      .eq('id', artiste.id)
      .select('*')
      .single();

    if (updateError) {
      setError(updateError.message);
    } else {
      onClose();
    }
    setIsSaving(false);
  };

  if (!isOpen) return null;

  // Determine provider display
  const isPaystack = formData.support_provider?.toLowerCase().includes('paystack') || false;
  const displayUrl = isPaystack ? formData.support_number : formData.support_number || 'N/A';
  const displaySubaccount = isPaystack ? formData.support_account_name : '';

  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-zinc-200">Support Details: {artiste.display_name || artiste.email}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/20 border border-red-400/40 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* ADMIN-ONLY PAYSTACK FIELDS */}
            {isAdminViewer && (
              <div className="space-y-4 p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase mb-2">
                  <AlertCircle className="w-3 h-3" />
                  Admin Paystack Configuration (Support Gyidi / Artiste)
                </div>
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
              </div>
            )}

            {/* Standard View (Non-Admin or Standard Provider) */}
            {!isAdminViewer && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                    Support Provider
                  </label>
                  <div className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200">
                    {formData.support_provider || 'MTN Mobile Money (MoMo)'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                    Account / URL
                  </label>
                  <div className="relative">
                    <div className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 pr-10">
                      {displayUrl || 'Not configured'}
                    </div>
                    {displayUrl && (
                      <button
                        type="button"
                        onClick={() => handleCopy(displayUrl)}
                        className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-amber-400 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                {isPaystack && displaySubaccount && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                      Subaccount Code
                    </label>
                    <div className="relative">
                      <div className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 pr-10">
                        {displaySubaccount}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(displaySubaccount)}
                        className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-amber-400 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {isAdminViewer && (
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
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
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
