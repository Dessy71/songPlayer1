import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone,
  MessageSquare,
  Send,
  Lock,
  ShieldCheck,
  Loader2,
  Trash2,
  Plus,
  User,
  BadgeCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ArtisteMessage, UserProfile } from '../types/music';

interface MessagesViewProps {
  currentProfile: UserProfile;
  allProfiles: UserProfile[];
  onUnreadCountChanged?: (count: number) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentProfile,
  allProfiles,
  onUnreadCountChanged,
}) => {
  const isAdmin = currentProfile.role === 'admin';

  const [channelTab, setChannelTab] = useState<'direct' | 'broadcasts'>('direct');
  const [messages, setMessages] = useState<ArtisteMessage[]>([]);
  const [readBroadcastIds, setReadBroadcastIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Direct 1-on-1 state
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);

  // Admin Broadcast composer state
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [directoryProfiles, setDirectoryProfiles] = useState<UserProfile[]>(allProfiles);

  const loadMessages = useCallback(async () => {
    const [{ data: msgData }, { data: readsData }, { data: profData }] = await Promise.all([
      supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(500),
      supabase
        .from('broadcast_reads')
        .select('message_id')
        .eq('profile_id', currentProfile.id),
      supabase
        .from('profiles')
        .select('*')
        .in('role', ['artiste', 'admin'])
        .order('stage_name', { ascending: true }),
    ]);

    const typedMsgs = (msgData || []) as ArtisteMessage[];
    const readSet = new Set(
      ((readsData || []) as Array<{ message_id: string }>).map((r) => r.message_id)
    );

    setMessages(typedMsgs);
    setReadBroadcastIds(readSet);
    // Suspended accounts cannot be messaged.
    if (profData)
      setDirectoryProfiles((profData as UserProfile[]).filter((p) => !p.is_banned));
    setLoading(false);

    // Compute total unread
    const unreadDirect = typedMsgs.filter(
      (m) => !m.is_broadcast && m.recipient_profile_id === currentProfile.id && !m.is_read
    ).length;
    const unreadBcast = typedMsgs.filter(
      (m) =>
        m.is_broadcast &&
        m.sender_profile_id !== currentProfile.id &&
        !readSet.has(m.id)
    ).length;

    onUnreadCountChanged?.(unreadDirect + unreadBcast);
  }, [currentProfile.id, onUnreadCountChanged]);

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(loadMessages, 12000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  const profileMap = useMemo(
    () => new Map(directoryProfiles.map((p) => [p.id, p])),
    [directoryProfiles]
  );

  // Broadcasts (newest first)
  const broadcasts = useMemo(
    () =>
      messages
        .filter((m) => m.is_broadcast)
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [messages]
  );

  // Mark broadcasts as read when viewing Broadcasts tab
  useEffect(() => {
    if (channelTab !== 'broadcasts') return;
    const unread = broadcasts.filter(
      (b) => b.sender_profile_id !== currentProfile.id && !readBroadcastIds.has(b.id)
    );
    if (unread.length === 0) return;

    const mark = async () => {
      const rows = unread.map((b) => ({
        message_id: b.id,
        profile_id: currentProfile.id,
      }));
      await supabase.from('broadcast_reads').upsert(rows);
      loadMessages();
    };
    mark();
  }, [channelTab, broadcasts, currentProfile.id, readBroadcastIds, loadMessages]);

  // Direct 1-on-1 conversations grouped by partner profile ID
  const directMessages = useMemo(
    () =>
      messages.filter(
        (m) =>
          !m.is_broadcast &&
          (m.sender_profile_id === currentProfile.id ||
            m.recipient_profile_id === currentProfile.id)
      ),
    [messages, currentProfile.id]
  );

  const conversations = useMemo(() => {
    const map = new Map<
      string,
      { partnerId: string; lastMessage: ArtisteMessage; unread: number }
    >();

    for (const m of directMessages) {
      const partnerId =
        m.sender_profile_id === currentProfile.id
          ? m.recipient_profile_id!
          : m.sender_profile_id;
      const existing = map.get(partnerId);
      const isUnreadIncoming =
        m.recipient_profile_id === currentProfile.id && !m.is_read ? 1 : 0;

      if (!existing) {
        map.set(partnerId, {
          partnerId,
          lastMessage: m,
          unread: isUnreadIncoming,
        });
      } else {
        existing.lastMessage = m;
        existing.unread += isUnreadIncoming;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() -
        new Date(a.lastMessage.created_at).getTime()
    );
  }, [directMessages, currentProfile.id]);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedPartnerId && conversations.length > 0) {
      setSelectedPartnerId(conversations[0].partnerId);
    }
  }, [conversations, selectedPartnerId]);

  const activeThreadMessages = useMemo(() => {
    if (!selectedPartnerId) return [];
    return directMessages.filter(
      (m) =>
        (m.sender_profile_id === currentProfile.id &&
          m.recipient_profile_id === selectedPartnerId) ||
        (m.sender_profile_id === selectedPartnerId &&
          m.recipient_profile_id === currentProfile.id)
    );
  }, [directMessages, currentProfile.id, selectedPartnerId]);

  // Mark incoming 1-on-1 messages in open thread as read
  useEffect(() => {
    if (channelTab !== 'direct' || !selectedPartnerId) return;
    const unreadIncomingIds = activeThreadMessages
      .filter((m) => m.recipient_profile_id === currentProfile.id && !m.is_read)
      .map((m) => m.id);
    if (unreadIncomingIds.length === 0) return;

    supabase
      .from('messages')
      .update({ is_read: true })
      .in('id', unreadIncomingIds)
      .then(() => loadMessages());
  }, [channelTab, selectedPartnerId, activeThreadMessages, currentProfile.id, loadMessages]);

  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId || !replyText.trim()) return;
    setSendingDirect(true);
    setError(null);

    try {
      const { data, error: insErr } = await supabase
        .from('messages')
        .insert({
          sender_profile_id: currentProfile.id,
          recipient_profile_id: selectedPartnerId,
          is_broadcast: false,
          body: replyText.trim(),
        })
        .select('*')
        .single();

      if (insErr) throw insErr;
      if (data) {
        setMessages((prev) => [...prev, data as ArtisteMessage]);
      }
      setReplyText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSendingDirect(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !broadcastBody.trim()) return;
    setSendingBroadcast(true);
    setError(null);

    try {
      const { data, error: insErr } = await supabase
        .from('messages')
        .insert({
          sender_profile_id: currentProfile.id,
          recipient_profile_id: null,
          is_broadcast: true,
          subject: broadcastSubject.trim() || 'Official Gyidi Nnwom Announcement',
          body: broadcastBody.trim(),
        })
        .select('*')
        .single();

      if (insErr) throw insErr;
      if (data) {
        setMessages((prev) => [...prev, data as ArtisteMessage]);
      }
      setBroadcastSubject('');
      setBroadcastBody('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Broadcast failed.');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!window.confirm('Delete this broadcast announcement?')) return;
    await supabase.from('messages').delete().eq('id', id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const unreadBroadcastCount = broadcasts.filter(
    (b) => b.sender_profile_id !== currentProfile.id && !readBroadcastIds.has(b.id)
  ).length;

  const unreadDirectCount = directMessages.filter(
    (m) => m.recipient_profile_id === currentProfile.id && !m.is_read
  ).length;

  const availableRecipients = directoryProfiles.filter((p) => p.id !== currentProfile.id);
  const selectedPartner = selectedPartnerId ? profileMap.get(selectedPartnerId) : null;

  return (
    <div className="max-w-[1380px] mx-auto space-y-5">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-gradient-to-r from-gold-500/15 via-pink-500/10 to-zinc-900 p-5 sm:p-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-gold-400" />
            Artiste & Admin Messaging Hub
          </h2>
          <p className="text-xs text-zinc-300 mt-1">
            {isAdmin
              ? 'Send read-only Broadcasts to all Artistes, or hold 1-on-1 conversations with individual Artistes'
              : 'Read official Admin Broadcast announcements and message or reply 1-on-1 with individual Artistes & Admin'}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-zinc-950/90 border border-white/10 p-1.5">
          <button
            onClick={() => setChannelTab('direct')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              channelTab === 'direct'
                ? 'bg-gold-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            1-on-1 Messages
            {unreadDirectCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {unreadDirectCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setChannelTab('broadcasts')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              channelTab === 'broadcasts'
                ? 'bg-gold-500 text-zinc-950'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Admin Broadcasts ({broadcasts.length})
            {unreadBroadcastCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {unreadBroadcastCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-12 text-center text-xs text-zinc-400">
          Loading messages...
        </div>
      ) : channelTab === 'broadcasts' ? (
        /* ADMIN BROADCASTS VIEW (Admin composes; Artistes read-only, NO replies!) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {isAdmin && (
            <form
              onSubmit={handleSendBroadcast}
              className="lg:col-span-5 rounded-2xl border border-gold-500/30 bg-zinc-900/70 p-5 space-y-3.5 h-fit"
            >
              <div className="flex items-center gap-2 text-gold-300 text-xs font-extrabold uppercase tracking-wider">
                <Megaphone className="w-4 h-4" />
                Broadcast to All Artistes
              </div>
              <p className="text-xs text-zinc-400">
                Every registered SCG & SACSU Artiste receives this announcement. Broadcasts are
                one-way (replies disabled).
              </p>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  placeholder="e.g. Easter Convention Song Submissions Open!"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Broadcast Message *
                </label>
                <textarea
                  rows={4}
                  required
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Write your announcement to all Artistes..."
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={sendingBroadcast || !broadcastBody.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-pink-600 py-2.5 text-xs font-extrabold text-white shadow-lg cursor-pointer disabled:opacity-50"
              >
                {sendingBroadcast ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Megaphone className="w-4 h-4" />
                )}
                Send Broadcast to All Artistes
              </button>
            </form>
          )}

          <div className={`${isAdmin ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
            {broadcasts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-12 text-center">
                <Megaphone className="w-9 h-9 text-gold-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-white">No broadcast announcements yet</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Official platform-wide updates from Master Admin appear here.
                </p>
              </div>
            ) : (
              broadcasts.map((b) => {
                const sender = profileMap.get(b.sender_profile_id);
                return (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-gold-500/25 bg-zinc-900/70 p-5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/20 border border-gold-400/40 px-2.5 py-0.5 text-[10px] font-extrabold text-gold-300">
                          <ShieldCheck className="w-3 h-3" />
                          Master Admin Broadcast
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {sender?.stage_name || sender?.display_name || 'Gyidi Nnwom Admin'} •{' '}
                          {new Date(b.created_at).toLocaleString()}
                        </span>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteBroadcast(b.id)}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/15 rounded-lg cursor-pointer"
                          title="Delete broadcast"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {b.subject && (
                      <h4 className="text-base font-extrabold text-white">{b.subject}</h4>
                    )}

                    <p className="text-xs sm:text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {b.body}
                    </p>

                    <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <Lock className="w-3 h-3 text-gold-400/80" />
                      Broadcast to all Artistes — replies are disabled on broadcasts.
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* 1-ON-1 DIRECT MESSAGES VIEW (Artiste <-> Artiste & Admin <-> Artiste, WITH REPLIES!) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[480px]">
          {/* Left Pane: Start New Chat + Thread List */}
          <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-zinc-900/65 p-4 flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gold-400 mb-1.5">
                <Plus className="w-3.5 h-3.5 inline mr-1" />
                Message an Individual Artiste {isAdmin ? '' : 'or Admin'}
              </label>
              <select
                value={selectedPartnerId || ''}
                onChange={(e) => {
                  if (e.target.value) setSelectedPartnerId(e.target.value);
                }}
                className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-gold-500 focus:outline-none"
              >
                <option value="">Select Artiste to message 1-on-1...</option>
                {availableRecipients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.stage_name || p.display_name || p.email}{' '}
                    {p.role === 'admin'
                      ? '(Master Admin)'
                      : p.is_sacsu
                      ? `(SACSU${p.tertiary_institution ? ` • ${p.tertiary_institution}` : ''})`
                      : p.scg_branch
                      ? `(${p.scg_branch})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 border-t border-white/10">
              {conversations.length === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">
                  No 1-on-1 conversations yet. Select an Artiste above to start a direct chat!
                </p>
              ) : (
                conversations.map((conv) => {
                  const partner = profileMap.get(conv.partnerId);
                  const active = selectedPartnerId === conv.partnerId;
                  return (
                    <button
                      key={conv.partnerId}
                      type="button"
                      onClick={() => setSelectedPartnerId(conv.partnerId)}
                      className={`w-full flex items-center justify-between gap-2.5 rounded-xl p-2.5 text-left transition cursor-pointer ${
                        active
                          ? 'bg-gold-500/20 border border-gold-400/40 text-white'
                          : 'bg-zinc-950/50 border border-white/5 text-zinc-300 hover:bg-zinc-950'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {partner?.avatar_url ? (
                          <img
                            src={partner.avatar_url}
                            alt=""
                            className="h-9 w-9 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-xs font-bold text-gold-300 flex-shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                            {partner?.stage_name || partner?.display_name || 'Artiste'}
                            {partner?.role === 'admin' && (
                              <ShieldCheck className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" />
                            )}
                            {partner?.is_verified_artiste && (
                              <BadgeCheck className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" />
                            )}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {conv.lastMessage.body}
                          </p>
                        </div>
                      </div>

                      {conv.unread > 0 && (
                        <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white flex-shrink-0">
                          {conv.unread}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane: Active 1-on-1 Conversation + Reply Input */}
          <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-zinc-900/65 flex flex-col overflow-hidden">
            {!selectedPartnerId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <MessageSquare className="w-10 h-10 text-gold-400/70 mb-2" />
                <p className="text-sm font-bold text-white">Select an Artiste to chat 1-on-1</p>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                  Direct 1-on-1 messages support full two-way replies between Artistes and with
                  Master Admin.
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-white/10 bg-zinc-950/70 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-extrabold text-white">
                      {selectedPartner?.stage_name ||
                        selectedPartner?.display_name ||
                        'Direct Conversation'}
                    </span>
                    {selectedPartner?.role === 'admin' && (
                      <span className="rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-300">
                        Master Admin
                      </span>
                    )}
                    {selectedPartner?.scg_branch && (
                      <span className="text-xs text-zinc-400">
                        • {selectedPartner.scg_branch}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-forest-400 font-semibold">
                    1-on-1 • Replies Enabled
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px]">
                  {activeThreadMessages.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-10">
                      Send a message below to start your 1-on-1 conversation with{' '}
                      {selectedPartner?.stage_name || 'this Artiste'}.
                    </p>
                  ) : (
                    activeThreadMessages.map((msg) => {
                      const mine = msg.sender_profile_id === currentProfile.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                              mine
                                ? 'bg-gradient-to-r from-gold-500 to-pink-600 text-white font-medium'
                                : 'bg-zinc-950 border border-white/10 text-zinc-200'
                            }`}
                          >
                            {msg.body}
                          </div>
                          <span className="text-[10px] text-zinc-500 mt-1 px-1">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <form
                  onSubmit={handleSendDirect}
                  className="border-t border-white/10 bg-zinc-950/90 p-3 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Write a 1-on-1 message or reply to ${
                      selectedPartner?.stage_name || 'Artiste'
                    }...`}
                    className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-gold-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingDirect || !replyText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gold-500 hover:bg-gold-400 px-4 py-2.5 text-xs font-extrabold text-zinc-950 transition cursor-pointer disabled:opacity-50"
                  >
                    {sendingDirect ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
