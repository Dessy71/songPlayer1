import React, { useState } from 'react';
import { Copy, Check, Wallet, Lock, Unlock, Edit2 } from 'lucide-react';
import { useSupabaseClient } from '@supabase/supabase-js';

import { UserProfile, Song } from '../types/music';
import { EditArtisteModal } from './EditArtisteModal';

interface ArtisteProfileViewProps {
  artiste: UserProfile;
  songs: Song[];
  isAdminViewer?: boolean;
  onRequirePremium?: (message: string) => void;
}

export const ArtisteProfileView: React.FC<ArtisteProfileViewProps> = ({
  artiste,
  songs,
  isAdminViewer = false,
  onRequirePremium,
}) => {
  const supabase = useSupabaseClient();
  const [editing, setEditing] = useState(false);
  const [copiedSupport, setCopiedSupport] = useState(false);

  const copyAccount = () => {
    if (!artiste.support_number) return;
    navigator.clipboard.writeText(artiste.support_number);
    setCopiedSupport(true);
    setTimeout(() => setCopiedSupport(false), 2000);
  };

  const handleEdit = () => {
    if (!isAdminViewer && artiste.approval_status !== 'approved') {
      onRequirePremium?.('Only approved artistes can be edited by fans. Admins can edit anytime.');
      return;
    }
    setEditing(true);
  };

  const isPaystack = artiste.support_provider?.toLowerCase().includes('paystack') || false;
  const displayUrl = isPaystack ? artiste.support_number : artiste.support_number || 'N/A';
  const displaySubaccount = isPaystack ? artiste.support_account_name : '';

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="flex items-center gap-6 bg-zinc-900 border border-white/10 rounded-2xl p-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center text-zinc-950 font-bold text-2xl shadow-lg">
          {artiste.display_name?.charAt(0) || 'A'}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-zinc-200">{artiste.display_name || artiste.email}</h2>
            {artiste.approval_status === 'approved' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-400/40 text-green-300 text-[10px] font-bold uppercase">
                <Check className="w-2.5 h-2.5" /> Approved
              </span>
            )}
            {isAdminViewer && (
              <button
                onClick={handleEdit}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-xs font-bold text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                Edit Profile
              </button>
            )}
          </div>
          <p className="text-sm text-zinc-400">{artiste.bio || 'No bio provided yet.'}</p>
          <div className="flex gap-4 text-xs font-bold text-zinc-500 uppercase">
            <span>Email: {artiste.email}</span>
            <span>Role: {artiste.role}</span>
          </div>
        </div>
      </div>

      {/* Fan Support Card */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            Fan Support & Ministry
          </h3>
          {isAdminViewer && (
            <span className="text-[10px] font-bold text-amber-400 uppercase bg-amber-400/10 px-2 py-0.5 rounded">
              Admin View
            </span>
          )}
        </div>

        {!artiste.support_number && !isAdminViewer ? (
          <div className="flex items-center gap-3 p-4 bg-zinc-800/50 border border-white/10 rounded-xl">
            <Lock className="w-5 h-5 text-zinc-500" />
            <div className="flex-1">
              <p className="text-sm text-zinc-400">Support details are private or not configured.</p>
              {!isAdminViewer && artiste.approval_status === 'approved' && (
                <button
                  onClick={() => onRequirePremium?.(`Upgrade to view ${artiste.display_name}'s support details!`)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-950 text-xs font-bold hover:bg-amber-300 transition-colors"
                >
                  <Unlock className="w-3 h-3" />
                  Unlock Artiste Support
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-zinc-400 mt-1">
              Send fan love & ministry support directly to this artiste:
            </p>
            <div className="mt-3 rounded-xl bg-zinc-900 border border-white/10 p-3">
              <p className="text-[10px] uppercase font-bold text-amber-400">
                {artiste.support_provider || 'MTN Mobile Money (MoMo)'}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm text-zinc-200 font-mono break-all">{displayUrl}</p>
                  {isPaystack && displaySubaccount && (
                    <p className="text-[10px] text-zinc-500 font-mono mt-1 break-all">Subaccount: {displaySubaccount}</p>
                  )}
                </div>
                <button
                  onClick={copyAccount}
                  disabled={!displayUrl}
                  className={`p-2 rounded-lg transition-colors ${
                    copiedSupport
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {copiedSupport ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <EditArtisteModal
          artiste={artiste}
          isOpen={true}
          onClose={() => setEditing(false)}
          isAdminViewer={isAdminViewer}
        />
      )}
    </div>
  );
};
