import React, { useState, useEffect } from 'react';
import {
  Users,
  Music,
  MessageSquare,
  Settings,
  ChevronRight,
  ChevronLeft,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Edit2,
  Trash2,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  MoreVertical,
  Calendar,
  Wallet,
  UserPlus,
  Star,
  TrendingUp,
  DollarSign,
  Lock,
  Unlock,
  ShieldCheck,
  Download,
  Share2,
  Eye,
  EyeOff,
  Info,
  AlertCircle,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Home,
  LayoutDashboard,
  FileText,
  Database,
  Server,
  Globe,
  Bell,
  User,
  Users2,
  UserCheck,
  UserX,
  UserMinus,
  UserPen,
  UserRound,
  UserCircle,
  UserSquare,
  UserSearch,
  UserHeart,
  UserStar,
  UserBadge,
  UserCog,
  UserPlus2,
  UserMinus2,
  UserX2,
  UserCheck2,
  UserPen2,
  UserRound2,
  UserCircle2,
  UserSquare2,
  UserSearch2,
  UserHeart2,
  UserStar2,
  UserBadge2,
  UserCog2,
  UserPlusCircle,
  UserMinusCircle,
  UserXCircle,
  UserCheckCircle,
  UserPenCircle,
  UserRoundCircle,
  UserCircleCircle,
  UserSquareCircle,
  UserSearchCircle,
  UserHeartCircle,
  UserStarCircle,
  UserBadgeCircle,
  UserCogCircle,
} from 'lucide-react';

import { useSupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import {
  AdminDashboardViewProps,
  UserProfile,
  Song,
  Album,
  Playlist,
  PremiumSubscription,
  VerifiedPremiumPayment,
} from '../types/music';

import { EditArtisteModal } from './EditArtisteModal';
import { SupportModal } from './SupportModal';
import { MessagesView } from './MessagesView';
import { AdminContentMonetizationPanel } from './AdminContentMonetizationPanel';
import { ProvisionArtisteLoginModal } from './ProvisionArtisteLoginModal';
import { EditReleaseModal } from './EditReleaseModal';

import { formatBytes, formatDuration } from '../lib/format';
import { usePlayer } from '../context/PlayerContext';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  initialSubTab = 'users',
  isAdminViewer = true, // Admin-only view
}) => {
  const supabase = useSupabaseClient();
  const [subTab, setSubTab] = useState<'users' | 'content' | 'monetization' | 'messages'>(initialSubTab);
  const [approvalFilter, setApprovalFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // NEW: Support Gyidi / Artiste Paystack URL & Subaccount Dashboard View
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [selectedArtisteForSupport, setSelectedArtisteForSupport] = useState<UserProfile | null>(null);

  const [editingArtiste, setEditingArtiste] = useState<UserProfile | null>(null);
  const [artisteModalOpen, setArtisteModalOpen] = useState(false);

  const [provisioningArtiste, setProvisioningArtiste] = useState<UserProfile | null>(null);

  const [editingCatalogSong, setEditingCatalogSong] = useState<Song | null>(null);
  const [editingReleaseModalOpen, setEditingReleaseModalOpen] = useState(false);

  // Fetch Artistes
  const { data: artistes, isLoading: loadingArtistes } = useQuery({
    queryKey: ['admin-dashboard-artistes', approvalFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'artiste')
        .eq('approval_status', approvalFilter)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserProfile[];
    },
    staleTime: 5000,
  });

  // Fetch Content (Songs, Albums, Playlists)
  const { data: songs, isLoading: loadingSongs } = useQuery({
    queryKey: ['admin-dashboard-songs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Song[];
    },
  });

  const { data: albums, isLoading: loadingAlbums } = useQuery({
    queryKey: ['admin-dashboard-albums'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Album[];
    },
  });

  const { data: playlists, isLoading: loadingPlaylists } = useQuery({
    queryKey: ['admin-dashboard-playlists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Playlist[];
    },
  });

  // Fetch Monetization Data
  const { data: subscriptions, isLoading: loadingSubscriptions } = useQuery({
    queryKey: ['admin-dashboard-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as PremiumSubscription[];
    },
  });

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ['admin-dashboard-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verified_premium_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as VerifiedPremiumPayment[];
    },
  });

  // Handle Approval/Rejection
  const handleApproveArtiste = async (artisteId: string) => {
    setBusyId(artisteId);
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', artisteId);
    if (error) alert(`Failed to approve: ${error.message}`);
    else setApprovalFilter('approved'); // Refresh
    setBusyId(null);
  };

  const handleRejectArtiste = async (artisteId: string) => {
    if (!rejectReason) return alert('Please provide a reason for rejection');
    setBusyId(artisteId);
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'rejected', rejection_reason: rejectReason, rejected_at: new Date().toISOString() })
      .eq('id', artisteId);
    if (error) alert(`Failed to reject: ${error.message}`);
    else {
      setApprovalFilter('rejected');
      setRejectingId(null);
      setRejectReason('');
    }
    setBusyId(null);
  };

  // Handle Provisioning
  const handleProvisionLogin = (artiste: UserProfile) => {
    setProvisioningArtiste(artiste);
  };

  // Render Subtabs
  return (
    <div className="space-y-6">
      {/* Subtab Navigation */}
      <div className="flex border-b border-white/10">
        {[
          { id: 'users', label: 'Artistes & Users', icon: Users2 },
          { id: 'content', label: 'Catalog Content', icon: Music },
          { id: 'monetization', label: 'Monetization', icon: DollarSign },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              subTab === tab.id
                ? 'border-b-2 border-amber-400 text-amber-400 bg-amber-400/5'
                : 'text-zinc-400 hover:text-zinc-200 border-b-2 border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="space-y-6">
        {subTab === 'users' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-white/10">
              <div className="flex gap-2">
                {['pending', 'approved', 'rejected'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setApprovalFilter(status as any)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                      approvalFilter === status
                        ? 'bg-amber-400 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search artistes..."
                  className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                />
                <Search className="w-4 h-4 text-zinc-400" />
              </div>
            </div>

            {/* Artiste Table */}
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-800/50 text-zinc-400 text-xs font-bold uppercase">
                    <th className="px-6 py-3">Artiste / Profile</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Support Details</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingArtistes ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                        Loading artistes...
                      </td>
                    </tr>
                  ) : artistes?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                        No artistes found for this filter.
                      </td>
                    </tr>
                  ) : (
                    artistes?.map((artiste) => (
                      <tr key={artiste.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center text-zinc-950 font-bold text-sm">
                              {artiste.display_name?.charAt(0) || 'A'}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-zinc-200">{artiste.display_name || artiste.email}</div>
                              <div className="text-[10px] text-zinc-500">{artiste.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            artiste.approval_status === 'approved'
                              ? 'bg-green-500/20 border border-green-400/40 text-green-300'
                              : artiste.approval_status === 'rejected'
                              ? 'bg-red-500/20 border border-red-400/40 text-red-300'
                              : 'bg-amber-500/20 border border-amber-400/40 text-amber-300'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {artiste.approval_status?.toUpperCase() || 'PENDING'}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <button
                            onClick={() => {
                              setSelectedArtisteForSupport(artiste);
                              setSupportModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:border-white/20 transition-colors"
                          >
                            <Wallet className="w-3 h-3 text-amber-400" />
                            Support Details
                          </button>
                        </td>
                        <td className="px-6 py-3 flex gap-2">
                          {artiste.approval_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproveArtiste(artiste.id)}
                                disabled={busyId === artiste.id}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                  busyId === artiste.id
                                    ? 'bg-zinc-800 text-zinc-500'
                                    : 'bg-green-500/20 border border-green-400/40 text-green-300 hover:bg-green-500/30'
                                }`}
                              >
                                {busyId === artiste.id ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectingId(artiste.id === rejectingId ? null : artiste.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                  rejectingId === artiste.id
                                    ? 'bg-red-500/20 border border-red-400/40 text-red-300'
                                    : 'bg-zinc-800 border border-white/10 text-zinc-400 hover:bg-zinc-700 hover:border-white/20'
                                }`}
                              >
                                <XCircle className="w-3 h-3" />
                                Reject
                              </button>
                              {rejectingId === artiste.id && (
                                <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-white/10 rounded-lg p-3 shadow-xl z-10">
                                  <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Reason for rejection..."
                                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-amber-400 h-16 resize-none"
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => handleRejectArtiste(artiste.id)}
                                      className="flex-1 px-2 py-1 bg-red-500/20 border border-red-400/40 text-red-300 text-xs font-bold rounded-lg hover:bg-red-500/30"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setRejectingId(null)}
                                      className="flex-1 px-2 py-1 bg-zinc-800 border border-white/10 text-zinc-400 text-xs font-bold rounded-lg hover:bg-zinc-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          {artiste.approval_status === 'approved' && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingArtiste(artiste);
                                  setArtisteModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:border-white/20 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleProvisionLogin(artiste)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs font-bold"
                              >
                                <UserPlus className="w-3 h-3" />
                                Provision
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {subTab === 'content' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-200">Catalog Content</h3>
              <button
                onClick={() => setEditingReleaseModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 text-zinc-950 rounded-lg text-sm font-bold hover:bg-amber-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Release
              </button>
            </div>
            {/* Content tables would go here */}
            <div className="text-center text-zinc-500 py-12">
              Content management tables (Songs, Albums, Playlists) would be rendered here.
            </div>
          </div>
        )}

        {subTab === 'monetization' && (
          <AdminContentMonetizationPanel />
        )}

        {subTab === 'messages' && (
          <MessagesView />
        )}
      </div>

      {/* Modals */}
      {artisteModalOpen && editingArtiste && (
        <EditArtisteModal
          artiste={editingArtiste}
          isOpen={artisteModalOpen}
          onClose={() => {
            setArtisteModalOpen(false);
            setEditingArtiste(null);
          }}
          isAdminViewer={isAdminViewer}
        />
      )}

      {supportModalOpen && selectedArtisteForSupport && (
        <SupportModal
          artiste={selectedArtisteForSupport}
          isOpen={supportModalOpen}
          onClose={() => {
            setSupportModalOpen(false);
            setSelectedArtisteForSupport(null);
          }}
          isAdminViewer={isAdminViewer}
        />
      )}

      {provisioningArtiste && (
        <ProvisionArtisteLoginModal
          artiste={provisioningArtiste}
          isOpen={true}
          onClose={() => setProvisioningArtiste(null)}
        />
      )}

      {editingReleaseModalOpen && (
        <EditReleaseModal
          song={editingCatalogSong}
          isOpen={editingReleaseModalOpen}
          onClose={() => {
            setEditingReleaseModalOpen(false);
            setEditingCatalogSong(null);
          }}
        />
      )}
    </div>
  );
};
