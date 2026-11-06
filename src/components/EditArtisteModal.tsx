import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';

import { UserProfile } from '../types/music';

interface EditArtisteModalProps {
  artiste: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  isAdminViewer?: boolean;
  onSaved?: (updatedArtiste: UserProfile) => void;
}

export const EditArtisteModal: React.FC<EditArtisteModalProps> = ({
  artiste,
  isOpen,
  onClose,
  isAdminViewer = false,
  onSaved,
}) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({ ...artiste });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...artiste });
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, artiste]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    // Map Paystack fields to support_number and support_account_name if provider is Paystack
    const updateData: Partial<UserProfile> = { ...formData };
    
    // Logic: If provider is "Paystack Payment Page", map URL -> support_number, Subaccount -> support_account_name
    // (Already mapped in the form inputs below)
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', artiste.id)
      .select('*')
      .single();

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      if (onSaved) onSaved(data as UserProfile);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    }
    setIsSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-lg font-bold text-zinc-200">Edit Artiste Profile</h3>
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

          {success && (
            <div className="flex items-start gap-2 p-3 bg-green-500/20 border border-green-400/40 rounded-lg text-green-300 text-sm">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              Profile updated successfully!
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Display Name</label>
              <input
                type="text"
                value={formData.display_name || ''}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                placeholder="Artiste Name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                placeholder="email@example.com"
                disabled={!isAdminViewer}
              />
            </div>

            {/* ADMIN-ONLY PAYSTACK FIELDS */}
            {isAdminViewer && (
              <div className="space-y-4 p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase mb-2">
                  <AlertCircle className="w-3 h-3" />
                  Admin Paystack Configuration
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                    Paystack Payment Page URL <span className="text-[10px] text-amber-400">(Mapped to support_number)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.support_number || ''}
                    onChange={(e) => setFormData({ ...formData, support_number: e.target.value })}
                    className="w-full bg-zinc-800/50 border border-amber-400/20 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    placeholder="https://paystack.com/pay/..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                    Subaccount Code <span className="text-[10px] text-amber-400">(Mapped to support_account_name)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.support_account_name || ''}
                    onChange={(e) => setFormData({ ...formData, support_account_name: e.target.value })}
                    className="w-full bg-zinc-800/50 border border-amber-400/20 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    placeholder="SUB-xxxxxxxxxxxx"
                  />
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

            {/* Standard fields */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Bio</label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-400 h-24 resize-none"
                placeholder="Artiste biography..."
              />
            </div>
          </div>

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
        </form>
      </div>
    </div>
  );
};
