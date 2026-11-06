import React, { useState } from 'react';
import { X, ListPlus, Plus, Check, Loader2 } from 'lucide-react';
import { Playlist, Song } from '../types/music';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  playlists: Playlist[];
  onCreatePlaylist: (name: string, description: string) => Promise<Playlist | null>;
  onAddSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  song,
  playlists,
  onCreatePlaylist,
  onAddSongToPlaylist,
}) => {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const created = await onCreatePlaylist(newName.trim(), newDesc.trim());
    if (created && song) {
      await onAddSongToPlaylist(created.id, song.id);
      setAddedId(created.id);
      setTimeout(onClose, 600);
    } else if (created) {
      setNewName('');
      setNewDesc('');
      onClose();
    }
    setCreating(false);
  };

  const handleQuickAdd = async (playlistId: string) => {
    if (!song) return;
    await onAddSongToPlaylist(playlistId, song.id);
    setAddedId(playlistId);
    setTimeout(() => {
      setAddedId(null);
      onClose();
    }, 550);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400">
            <ListPlus className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">
              {song ? 'Add to Playlist' : 'Create New Playlist'}
            </h2>
            {song && (
              <p className="text-xs text-zinc-400 truncate">
                {song.title} • {song.artist}
              </p>
            )}
          </div>
        </div>

        {song && playlists.length > 0 && (
          <div className="mb-4 max-h-44 overflow-y-auto space-y-1.5">
            {playlists.map((pl) => {
              const alreadyIn = pl.song_ids?.includes(song.id) || addedId === pl.id;
              return (
                <button
                  key={pl.id}
                  onClick={() => handleQuickAdd(pl.id)}
                  disabled={alreadyIn}
                  className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-zinc-950/70 px-3.5 py-2.5 text-left hover:border-white/20 transition cursor-pointer disabled:opacity-70"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{pl.name}</p>
                    <p className="text-xs text-zinc-500">
                      {(pl.song_ids?.length || 0)} tracks
                    </p>
                  </div>
                  {alreadyIn ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                      <Check className="w-4 h-4" /> Added
                    </span>
                  ) : (
                    <Plus className="w-4 h-4 text-zinc-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3 pt-2 border-t border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {playlists.length > 0 && song ? 'Or New Playlist' : 'Playlist Details'}
          </p>
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Sabbath Morning Hymns"
            className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional description..."
            className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {song ? 'Create & Add Song' : 'Create Playlist'}
          </button>
        </form>
      </div>
    </div>
  );
};
