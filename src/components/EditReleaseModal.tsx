import React, { useEffect, useState } from 'react';
import {
  X,
  Image as ImageIcon,
  Save,
  Trash2,
  Loader2,
  CheckCircle2,
  Disc3,
  Music,
  FileText,
  BookOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Album, Song, TimedLyricLine } from '../types/music';
import { CoverArt } from './CoverArt';
import {
  parseLyricsFile,
  parseLyricsInput,
  SUPPORTED_LYRICS_EXTENSIONS,
} from '../lib/lyrics';

interface EditReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  song?: Song | null;
  album?: Album | null;
  albumTracks?: Song[];
  onSaved: () => void;
  onDeleted: () => void;
}

const CHOIR_GROUPS = [
  'SCG Hymns',
  'Obogu Choir',
  'Accra Choir',
  'Yaw Baidoo',
  'Mponua Choir',
  'Kumawu Choir',
  'Osiem Choir',
  'Sekyere Choir',
  'Corner Boy',
  'Featured Singers',
  'SACSU Campus Ministry',
  'Sermons & Teachings',
  'Live Recordings',
];

export const EditReleaseModal: React.FC<EditReleaseModalProps> = ({
  isOpen,
  onClose,
  song,
  album,
  albumTracks = [],
  onSaved,
  onDeleted,
}) => {
  const isAlbumMode = Boolean(album);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Songs');
  const [choirGroup, setChoirGroup] = useState('SCG Hymns');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({});

  // Lyrics state (for editing single or catalog songs!)
  const [lyricsText, setLyricsText] = useState('');
  const [lyricsTimed, setLyricsTimed] = useState<TimedLyricLine[] | null>(null);
  const [lyricsLanguage, setLyricsLanguage] = useState('Twi');
  const [lyricsFormat, setLyricsFormat] = useState('text');
  const [lyricsNotice, setLyricsNotice] = useState<string | null>(null);

  // Sermon metadata state
  const [preacherName, setPreacherName] = useState('');
  const [sermonTopic, setSermonTopic] = useState('');
  const [bibleBook, setBibleBook] = useState('');
  const [conventionYear, setConventionYear] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (album) {
      setTitle(album.title);
      setArtist(album.artist);
      setDescription(album.description || '');
      setCategory(album.category || 'Songs');
      setChoirGroup(album.choir_group || 'SCG Hymns');
      setCoverUrl(album.cover_url || null);
      setCoverFile(null);
      const map: Record<string, string> = {};
      for (const t of albumTracks) {
        map[t.id] = t.title;
      }
      setTrackTitles(map);
    } else if (song) {
      setTitle(song.title);
      setArtist(song.artist);
      setDescription('');
      setCategory(song.category || 'Songs');
      setChoirGroup(song.choir_group || 'SCG Hymns');
      setCoverUrl(song.cover_url || null);
      setCoverFile(null);
      setTrackTitles({});

      setLyricsText(song.lyrics_text || '');
      setLyricsTimed(song.lyrics_timed || null);
      setLyricsLanguage(song.lyrics_language || 'Twi');
      setLyricsFormat(song.lyrics_format || 'text');
      setLyricsNotice(null);

      setPreacherName(song.preacher_name || '');
      setSermonTopic(song.sermon_topic || '');
      setBibleBook(song.bible_book || '');
      setConventionYear(song.convention_year ? String(song.convention_year) : '');
    }
    setError(null);
    setOkMsg(null);
  }, [album, song, albumTracks, isOpen]);

  if (!isOpen || (!song && !album)) return null;

  const handleLyricsFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const parsed = await parseLyricsFile(file);
      setLyricsText(parsed.lyricsText);
      setLyricsTimed(parsed.lyricsTimed);
      setLyricsFormat(parsed.detectedFormat);
      setLyricsNotice(
        parsed.lyricsTimed
          ? `Imported ${file.name} (${parsed.lyricsTimed.length} synced lines • .${parsed.detectedFormat})`
          : `Imported lyrics from ${file.name} (.${parsed.detectedFormat})`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse lyrics file.');
    }
    e.target.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let nextCoverUrl = coverUrl;

      if (coverFile) {
        const ext = (coverFile.name.split('.').pop() || 'jpg').toLowerCase();
        const slugBase = title
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 40);
        const path = `art/${slugBase || 'cover'}-${Date.now().toString(36)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('covers')
          .upload(path, coverFile, { cacheControl: '31536000', upsert: true });
        if (upErr) throw upErr;
        nextCoverUrl = supabase.storage.from('covers').getPublicUrl(path).data.publicUrl;
      }

      if (isAlbumMode && album) {
        const { error: albErr } = await supabase
          .from('albums')
          .update({
            title: title.trim(),
            artist: artist.trim() || album.artist,
            description: description.trim() || null,
            category,
            choir_group: choirGroup,
            cover_url: nextCoverUrl || album.cover_url,
          })
          .eq('id', album.id);

        if (albErr) throw albErr;

        for (const trk of albumTracks) {
          const newTrackTitle = (trackTitles[trk.id] || trk.title).trim();
          const { error: trkErr } = await supabase
            .from('songs')
            .update({
              title: newTrackTitle || trk.title,
              artist: artist.trim() || trk.artist,
              category,
              choir_group: choirGroup,
              cover_url: nextCoverUrl || trk.cover_url,
            })
            .eq('id', trk.id);
          if (trkErr) throw trkErr;
        }
      } else if (song) {
        const parsedYear = conventionYear.trim() ? parseInt(conventionYear.trim(), 10) : null;
        const resolvedLyrics = lyricsText.trim()
          ? lyricsTimed
            ? { lyricsText: lyricsText.trim(), lyricsTimed, detectedFormat: lyricsFormat }
            : parseLyricsInput(lyricsText, lyricsFormat)
          : null;

        const { error: sErr } = await supabase
          .from('songs')
          .update({
            title: title.trim(),
            artist: artist.trim() || song.artist,
            category,
            choir_group: choirGroup,
            cover_url: nextCoverUrl,
            lyrics_text: resolvedLyrics?.lyricsText || null,
            lyrics_timed: resolvedLyrics?.lyricsTimed || null,
            lyrics_language: resolvedLyrics ? lyricsLanguage : null,
            lyrics_format: resolvedLyrics?.detectedFormat || null,
            preacher_name: category === 'Sermons' ? preacherName.trim() || null : null,
            sermon_topic: category === 'Sermons' ? sermonTopic.trim() || null : null,
            bible_book: category === 'Sermons' ? bibleBook.trim() || null : null,
            convention_year:
              category === 'Sermons' && parsedYear && !Number.isNaN(parsedYear)
                ? parsedYear
                : null,
          })
          .eq('id', song.id);
        if (sErr) throw sErr;
      }

      setOkMsg('Changes saved!');
      onSaved();
      setTimeout(() => {
        setOkMsg(null);
        onClose();
      }, 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const label = isAlbumMode ? `entire album "${title}" and all its tracks` : `song "${title}"`;
    if (!window.confirm(`Are you sure you want to permanently delete ${label}?`)) return;

    setDeleting(true);
    setError(null);
    try {
      if (isAlbumMode && album) {
        const paths = albumTracks.map((t) => t.storage_path).filter(Boolean);
        const { error: delErr } = await supabase.from('albums').delete().eq('id', album.id);
        if (delErr) throw delErr;
        if (paths.length > 0) {
          await supabase.storage.from('songs').remove(paths);
        }
      } else if (song) {
        const { error: delErr } = await supabase.from('songs').delete().eq('id', song.id);
        if (delErr) throw delErr;
        if (song.storage_path && song.storage_path.startsWith('uploads/')) {
          await supabase.storage.from('songs').remove([song.storage_path]);
        }
      }
      onDeleted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete release.');
    } finally {
      setDeleting(false);
    }
  };

  const previewCover = coverFile ? URL.createObjectURL(coverFile) : coverUrl;

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
            {isAlbumMode ? <Disc3 className="w-5 h-5" /> : <Music className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">
              {isAlbumMode ? 'Edit or Delete Album' : 'Edit Song, Cover Art & Lyrics'}
            </h2>
            <p className="text-xs text-zinc-400">
              Update cover art, title, {isAlbumMode ? 'tracklist' : 'lyrics (text or file)'}, or
              remove from Gyidi Nwom
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-950/70 p-3.5">
            <CoverArt
              title={title || 'Track'}
              category={category}
              theme={(album?.cover_theme || song?.cover_theme) ?? 'gold'}
              coverUrl={previewCover}
              size="md"
              className="h-16 w-16 rounded-xl flex-shrink-0 border border-white/10"
            />
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-xs font-bold text-white">
                {isAlbumMode ? 'General Album Cover Art' : 'Song Cover Art'}
              </p>
              <label className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 cursor-pointer transition">
                <ImageIcon className="w-3.5 h-3.5" />
                {coverFile ? `Selected: ${coverFile.name}` : 'Upload / Change Cover Art'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {isAlbumMode ? 'Album Title *' : 'Song / Sermon Title *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Artiste / Stage Name *
              </label>
              <input
                type="text"
                required
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {isAlbumMode && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Album Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional album description..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="Songs">Songs</option>
                <option value="Sermons">Sermons</option>
                <option value="Recordings">Recordings</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Choir / Collection
              </label>
              <select
                value={choirGroup}
                onChange={(e) => setChoirGroup(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                {CHOIR_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Single Song Lyrics & Sermon Tags */}
          {!isAlbumMode && (
            <>
              {category === 'Sermons' && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-2">
                  <p className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    Sermon Preacher, Topic &amp; Bible Book
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={preacherName}
                      onChange={(e) => setPreacherName(e.target.value)}
                      placeholder="Preacher Name"
                      className="rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={sermonTopic}
                      onChange={(e) => setSermonTopic(e.target.value)}
                      placeholder="Topic / Occasion"
                      className="rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={bibleBook}
                      onChange={(e) => setBibleBook(e.target.value)}
                      placeholder="Bible Book"
                      className="rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="number"
                      value={conventionYear}
                      onChange={(e) => setConventionYear(e.target.value)}
                      placeholder="Year (e.g. 2026)"
                      className="rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-amber-400/25 bg-zinc-950/80 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Song Lyrics (Text or Any Lyrics File)
                  </span>

                  <div className="flex items-center gap-2">
                    <select
                      value={lyricsLanguage}
                      onChange={(e) => setLyricsLanguage(e.target.value)}
                      className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-[11px] text-white"
                    >
                      <option value="Twi">Twi</option>
                      <option value="Twi & English">Twi &amp; English</option>
                      <option value="English">English</option>
                      <option value="Other">Other</option>
                    </select>

                    <label className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-400/35 px-2.5 py-1 text-[11px] font-bold text-amber-300 cursor-pointer hover:bg-amber-500/30">
                      <FileText className="w-3 h-3" />
                      Upload Lyrics File
                      <input
                        type="file"
                        accept={SUPPORTED_LYRICS_EXTENSIONS}
                        onChange={handleLyricsFileImport}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {lyricsNotice && (
                  <p className="text-[11px] font-semibold text-emerald-300">✓ {lyricsNotice}</p>
                )}

                <textarea
                  rows={5}
                  value={lyricsText}
                  onChange={(e) => {
                    setLyricsText(e.target.value);
                    setLyricsTimed(null);
                  }}
                  placeholder="Type or paste Twi / English lyrics here, OR upload any lyrics file (.lrc, .srt, .vtt, .txt, .docx, .rtf, .ttml, .json)..."
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Individual Track Titles + Per-Track Lyrics File Import when editing an Album */}
          {isAlbumMode && albumTracks.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3 space-y-2">
              <p className="text-xs font-bold text-zinc-300">
                Edit Track Titles &amp; Lyrics ({albumTracks.length} tracks)
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {[...albumTracks]
                  .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
                  .map((trk, idx) => (
                    <div key={trk.id} className="flex items-center gap-2">
                      <span className="w-5 text-xs font-bold text-amber-400 tabular-nums">
                        {trk.track_number || idx + 1}.
                      </span>
                      <input
                        type="text"
                        required
                        value={trackTitles[trk.id] ?? trk.title}
                        onChange={(e) =>
                          setTrackTitles((prev) => ({ ...prev, [trk.id]: e.target.value }))
                        }
                        className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                      />
                      <label
                        className="rounded-lg bg-amber-500/15 border border-amber-400/30 px-2 py-1 text-[10px] font-bold text-amber-300 cursor-pointer"
                        title="Upload lyrics file for this album track"
                      >
                        {trk.lyrics_text ? 'Lyrics ✓' : '+ Lyrics File'}
                        <input
                          type="file"
                          accept={SUPPORTED_LYRICS_EXTENSIONS}
                          className="hidden"
                          onChange={async (ev) => {
                            const f = ev.target.files?.[0];
                            if (!f) return;
                            try {
                              const parsed = await parseLyricsFile(f);
                              await supabase
                                .from('songs')
                                .update({
                                  lyrics_text: parsed.lyricsText,
                                  lyrics_timed: parsed.lyricsTimed,
                                  lyrics_format: parsed.detectedFormat,
                                })
                                .eq('id', trk.id);
                              setOkMsg(`Lyrics uploaded for "${trk.title}"!`);
                              onSaved();
                            } catch {
                              setError('Could not parse track lyrics file.');
                            }
                          }}
                        />
                      </label>
                    </div>
                  ))}
              </div>
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              disabled={deleting || saving}
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/15 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition cursor-pointer disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isAlbumMode ? 'Delete Entire Album' : 'Delete Song'}
            </button>

            <button
              type="submit"
              disabled={saving || deleting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
