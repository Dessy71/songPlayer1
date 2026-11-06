import React from 'react';
import { ArrowLeft, X, Trash2, Play, ListMusic } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { CoverArt } from './CoverArt';
import { formatDuration } from '../lib/format';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const { currentSong, queue, playSong, removeFromQueue } = usePlayer();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-zinc-950 border-l border-white/10 h-full flex flex-col pb-24 shadow-2xl">
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-white/10 bg-zinc-900/70">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/15 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/15 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ListMusic className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Up Next Queue</h3>
              <p className="text-xs text-zinc-400">{queue.length} tracks queued</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {queue.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              Your playback queue is empty. Select any song to start streaming.
            </div>
          ) : (
            queue.map((song) => {
              const active = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  onClick={() => playSong(song)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer transition ${
                    active ? 'bg-amber-500/15 border border-amber-500/30' : 'hover:bg-white/5'
                  }`}
                >
                  <CoverArt
                    title={song.title}
                    category={song.category}
                    theme={song.cover_theme}
                    coverUrl={song.cover_url}
                    size="sm"
                    className="h-9 w-9 rounded-lg flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold truncate ${
                        active ? 'text-amber-300' : 'text-zinc-100'
                      }`}
                    >
                      {song.title}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {song.artist} • {formatDuration(song.duration_seconds)}
                    </p>
                  </div>
                  {active ? (
                    <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(song.id);
                      }}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-rose-400 transition cursor-pointer"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
