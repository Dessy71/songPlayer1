import React, { useMemo, useState } from 'react';
import {
  X,
  UploadCloud,
  Music,
  Disc3,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  Calendar,
  Zap,
  ShieldCheck,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
  BookOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Album, Song, TimedLyricLine, UserProfile } from '../types/music';
import { formatDuration } from '../lib/format';
import {
  parseLyricsFile,
  parseLyricsInput,
  SUPPORTED_LYRICS_EXTENSIONS,
} from '../lib/lyrics';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  authUserId: string;
  onSubmitted: (payload: { songs: Song[]; album?: Album }) => void;
}

interface AlbumDraftTrack {
  id: string;
  file: File;
  title: string;
  durationSeconds: number;
  lyricsRaw?: string;
  lyricsTimed?: TimedLyricLine[] | null;
  lyricsFormat?: string;
  lyricsLanguage?: string;
  showLyricsEditor?: boolean;
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

const THEMES = ['gold', 'emerald', 'sunset', 'violet', 'ocean', 'crimson', 'amber', 'indigo'];

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function cleanTrackTitleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/^\s*\d{1,2}\s*[-._)]\s*/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  profile,
  authUserId,
  onSubmitted,
}) => {
  const defaultStageName = profile.stage_name || profile.display_name || '';
  const isAdmin = profile.role === 'admin';

  const minPremiereDate = useMemo(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000);
    return toLocalDatetimeInputValue(d);
  }, [isOpen]);

  // Format: Single Track vs Full Album / EP
  const [uploadFormat, setUploadFormat] = useState<'single' | 'album'>('single');
  const [releaseMode, setReleaseMode] = useState<'instant' | 'premiere'>('instant');
  const [premiereLocalDt, setPremiereLocalDt] = useState(minPremiereDate);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState(defaultStageName);
  const [albumDescription, setAlbumDescription] = useState('');
  const [category, setCategory] = useState<'Songs' | 'Sermons' | 'Recordings'>('Songs');
  const [choirGroup, setChoirGroup] = useState(
    profile.is_sacsu ? 'SACSU Campus Ministry' : 'SCG Hymns'
  );
  const [adminAutoApprove, setAdminAutoApprove] = useState(isAdmin);

  // Single audio state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [detectedDuration, setDetectedDuration] = useState<number>(0);

  // Single Lyrics state (Text OR Any Lyrics File Format!)
  const [lyricsRaw, setLyricsRaw] = useState('');
  const [lyricsTimed, setLyricsTimed] = useState<TimedLyricLine[] | null>(null);
  const [lyricsLanguage, setLyricsLanguage] = useState('Twi');
  const [lyricsFormat, setLyricsFormat] = useState('text');
  const [lyricsFileNotice, setLyricsFileNotice] = useState<string | null>(null);

  // Sermon metadata state
  const [preacherName, setPreacherName] = useState('');
  const [sermonTopic, setSermonTopic] = useState('');
  const [bibleBook, setBibleBook] = useState('');
  const [conventionYear, setConventionYear] = useState('');

  // Album multi-track state
  const [albumTracks, setAlbumTracks] = useState<AlbumDraftTrack[]>([]);

  // Cover Art
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const probeAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const tempUrl = URL.createObjectURL(file);
      const probe = new Audio(tempUrl);
      const finish = (sec: number) => {
        URL.revokeObjectURL(tempUrl);
        resolve(sec);
      };
      probe.addEventListener('loadedmetadata', () => {
        finish(Number.isFinite(probe.duration) ? Math.round(probe.duration) : 180);
      });
      probe.addEventListener('error', () => finish(180));
    });
  };

  const handleSingleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAudioFile(file);
    setError(null);
    if (!file) return;
    if (!title) {
      setTitle(cleanTrackTitleFromFilename(file.name));
    }
    const dur = await probeAudioDuration(file);
    setDetectedDuration(dur);
  };

  const handleSingleLyricsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const parsed = await parseLyricsFile(file);
      setLyricsRaw(parsed.lyricsText);
      setLyricsTimed(parsed.lyricsTimed);
      setLyricsFormat(parsed.detectedFormat);
      setLyricsFileNotice(
        parsed.lyricsTimed
          ? `Loaded ${file.name} (${parsed.lyricsTimed.length} synced timestamp lines • .${parsed.detectedFormat})`
          : `Loaded lyrics from ${file.name} (.${parsed.detectedFormat})`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse lyrics file.');
    }
    e.target.value = '';
  };

  const handleAddAlbumFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError(null);

    const added: AlbumDraftTrack[] = [];
    for (const f of files) {
      if (f.size > 50 * 1024 * 1024) {
        setError(`"${f.name}" exceeds the 50 MB per-track limit.`);
        continue;
      }
      const dur = await probeAudioDuration(f);
      added.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        title:
          cleanTrackTitleFromFilename(f.name) ||
          `Track ${albumTracks.length + added.length + 1}`,
        durationSeconds: dur,
        lyricsLanguage: 'Twi',
      });
    }
    setAlbumTracks((prev) => [...prev, ...added]);
    e.target.value = '';
  };

  const moveAlbumTrack = (idx: number, dir: -1 | 1) => {
    setAlbumTracks((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const isPremiere = releaseMode === 'premiere';
    let premiereIso: string | null = null;

    if (isPremiere) {
      if (!coverFile) {
        setError('Scheduled Premieres require a Cover Art image.');
        return;
      }
      if (!premiereLocalDt) {
        setError('Please pick a premiere release date & time.');
        return;
      }
      const chosenMs = new Date(premiereLocalDt).getTime();
      const sevenDaysMs = Date.now() + 7 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000;
      if (Number.isNaN(chosenMs) || chosenMs < sevenDaysMs) {
        setError('Premiere date must be at least 7 days from submission.');
        return;
      }
      premiereIso = new Date(chosenMs).toISOString();
    }

    if (uploadFormat === 'album') {
      if (!coverFile) {
        setError('Album uploads require a general Album Cover Art image.');
        return;
      }
      if (albumTracks.length < 2) {
        setError('An Album / EP must include at least 2 tracks (use Single for 1 track).');
        return;
      }
      if (albumTracks.some((t) => !t.title.trim())) {
        setError('Please make sure every track on the album has a title.');
        return;
      }
    } else {
      if (!audioFile) {
        setError('Please select an audio file (.mp3, .m4a, .ogg, or .wav).');
        return;
      }
      if (audioFile.size > 50 * 1024 * 1024) {
        setError('Audio file exceeds the 50 MB limit.');
        return;
      }
    }

    setUploading(true);
    const randomTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const desiredStatus = isAdmin && adminAutoApprove ? 'approved' : 'pending';
    const cleanArtist = (artist.trim() || defaultStageName || 'SCG Artiste').trim();

    const parsedYear = conventionYear.trim() ? parseInt(conventionYear.trim(), 10) : null;

    try {
      let coverUrl: string | null = null;
      const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 44);
      const batchId = Date.now().toString(36);

      if (coverFile) {
        setProgressText('Uploading cover artwork...');
        const coverExt = (coverFile.name.split('.').pop() || 'jpg').toLowerCase();
        const coverPath = `art/${baseSlug || 'release'}-${batchId}.${coverExt}`;
        const { error: coverErr } = await supabase.storage
          .from('covers')
          .upload(coverPath, coverFile, {
            cacheControl: '31536000',
            upsert: false,
          });
        if (coverErr) throw coverErr;
        coverUrl = supabase.storage.from('covers').getPublicUrl(coverPath).data.publicUrl;
      }

      if (uploadFormat === 'single' && audioFile) {
        setProgressText('Uploading audio track...');
        const ext = (audioFile.name.split('.').pop() || 'mp3').toLowerCase();
        const uniqueSlug = `${baseSlug || 'track'}-${batchId}`;
        const storagePath = `uploads/${uniqueSlug}.${ext}`;

        const { error: storageErr } = await supabase.storage
          .from('songs')
          .upload(storagePath, audioFile, {
            cacheControl: '31536000',
            upsert: false,
            contentType: audioFile.type || 'audio/mpeg',
          });
        if (storageErr) throw storageErr;

        const { data: pubAudio } = supabase.storage.from('songs').getPublicUrl(storagePath);

        // Parse lyrics text one last time in case Artiste pasted raw LRC timestamps into textarea
        const finalLyrics = lyricsRaw.trim()
          ? lyricsTimed
            ? { lyricsText: lyricsRaw.trim(), lyricsTimed, detectedFormat: lyricsFormat }
            : parseLyricsInput(lyricsRaw, lyricsFormat)
          : null;

        const { data: inserted, error: dbErr } = await supabase
          .from('songs')
          .insert({
            slug: uniqueSlug,
            title: title.trim(),
            artist: cleanArtist,
            original_name: audioFile.name.replace(/\.[^/.]+$/, ''),
            category,
            choir_group: choirGroup,
            storage_path: storagePath,
            stream_url: pubAudio.publicUrl,
            cover_theme: randomTheme,
            cover_url: coverUrl,
            duration_seconds: detectedDuration || 180,
            file_size_bytes: audioFile.size,
            uploaded_by: authUserId,
            artiste_id: profile.id,
            approval_status: desiredStatus,
            is_premiere: isPremiere,
            premiere_at: premiereIso,
            lyrics_text: finalLyrics?.lyricsText || null,
            lyrics_timed: finalLyrics?.lyricsTimed || null,
            lyrics_language: finalLyrics ? lyricsLanguage : null,
            lyrics_format: finalLyrics?.detectedFormat || null,
            preacher_name: category === 'Sermons' ? preacherName.trim() || cleanArtist : null,
            sermon_topic: category === 'Sermons' ? sermonTopic.trim() || null : null,
            bible_book: category === 'Sermons' ? bibleBook.trim() || null : null,
            convention_year:
              category === 'Sermons' && parsedYear && !Number.isNaN(parsedYear)
                ? parsedYear
                : null,
          })
          .select('*')
          .single();

        if (dbErr) throw dbErr;
        onSubmitted({ songs: [inserted as Song] });
      } else {
        const albumSlug = `album-${baseSlug || 'scg'}-${batchId}`;
        setProgressText('Creating album record...');

        const { data: albumRow, error: albErr } = await supabase
          .from('albums')
          .insert({
            slug: albumSlug,
            title: title.trim(),
            artist: cleanArtist,
            artiste_id: profile.id,
            uploaded_by: authUserId,
            description: albumDescription.trim() || null,
            category,
            choir_group: choirGroup,
            cover_url: coverUrl!,
            cover_theme: randomTheme,
            approval_status: desiredStatus,
            is_premiere: isPremiere,
            premiere_at: premiereIso,
          })
          .select('*')
          .single();

        if (albErr) throw albErr;
        const createdAlbum = albumRow as Album;
        const insertedTracks: Song[] = [];

        for (let i = 0; i < albumTracks.length; i++) {
          const item = albumTracks[i];
          setProgressText(`Uploading Track ${i + 1} of ${albumTracks.length}: "${item.title}"...`);
          const ext = (item.file.name.split('.').pop() || 'mp3').toLowerCase();
          const tSlugBase = item.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 36);
          const trackSlug = `${albumSlug}-${i + 1}-${tSlugBase || 'track'}`;
          const storagePath = `uploads/${trackSlug}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from('songs')
            .upload(storagePath, item.file, {
              cacheControl: '31536000',
              upsert: false,
              contentType: item.file.type || 'audio/mpeg',
            });
          if (upErr) throw upErr;

          const { data: pubAudio } = supabase.storage.from('songs').getPublicUrl(storagePath);

          const trkLyrics = item.lyricsRaw?.trim()
            ? item.lyricsTimed
              ? {
                  lyricsText: item.lyricsRaw.trim(),
                  lyricsTimed: item.lyricsTimed,
                  detectedFormat: item.lyricsFormat || 'lrc',
                }
              : parseLyricsInput(item.lyricsRaw, item.lyricsFormat || 'text')
            : null;

          const { data: songRow, error: sErr } = await supabase
            .from('songs')
            .insert({
              slug: trackSlug,
              title: item.title.trim(),
              artist: cleanArtist,
              original_name: item.file.name.replace(/\.[^/.]+$/, ''),
              category,
              choir_group: choirGroup,
              storage_path: storagePath,
              stream_url: pubAudio.publicUrl,
              cover_theme: randomTheme,
              cover_url: coverUrl,
              duration_seconds: item.durationSeconds || 180,
              file_size_bytes: item.file.size,
              uploaded_by: authUserId,
              artiste_id: profile.id,
              album_id: createdAlbum.id,
              track_number: i + 1,
              approval_status: desiredStatus,
              is_premiere: isPremiere,
              premiere_at: premiereIso,
              lyrics_text: trkLyrics?.lyricsText || null,
              lyrics_timed: trkLyrics?.lyricsTimed || null,
              lyrics_language: trkLyrics ? item.lyricsLanguage || 'Twi' : null,
              lyrics_format: trkLyrics?.detectedFormat || null,
              preacher_name: category === 'Sermons' ? preacherName.trim() || cleanArtist : null,
              sermon_topic: category === 'Sermons' ? sermonTopic.trim() || null : null,
              bible_book: category === 'Sermons' ? bibleBook.trim() || null : null,
              convention_year:
                category === 'Sermons' && parsedYear && !Number.isNaN(parsedYear)
                  ? parsedYear
                  : null,
            })
            .select('*')
            .single();

          if (sErr) throw sErr;
          insertedTracks.push(songRow as Song);
        }

        onSubmitted({ songs: insertedTracks, album: createdAlbum });
      }

      setSuccessMsg(
        desiredStatus === 'approved'
          ? isPremiere
            ? 'Premiere approved! Countdown & cover art are now live.'
            : 'Published live on Gyidi Nwom!'
          : uploadFormat === 'album'
          ? `Album (${albumTracks.length} tracks) submitted to Admin for pre-listening & approval!`
          : 'Submitted to Admin Dashboard for pre-listening & approval!'
      );

      setTimeout(() => {
        setSuccessMsg(null);
        setTitle('');
        setAlbumDescription('');
        setAudioFile(null);
        setLyricsRaw('');
        setLyricsTimed(null);
        setLyricsFileNotice(null);
        setAlbumTracks([]);
        setCoverFile(null);
        setProgressText('');
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Upload or Premiere — Single or Full Album
            </h2>
            <p className="text-xs text-zinc-400">
              Submitting as <span className="text-amber-300 font-semibold">{defaultStageName}</span>
              {profile.is_sacsu && profile.tertiary_institution
                ? ` • SACSU (${profile.tertiary_institution})`
                : profile.scg_branch
                ? ` • ${profile.scg_branch}`
                : ''}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Format Toggle: Single vs Full Album */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setUploadFormat('single')}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                uploadFormat === 'single'
                  ? 'border-pink-400 bg-pink-500/15 text-white'
                  : 'border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Music className="w-4 h-4 text-pink-400" />
                Single Song / Sermon
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Upload 1 song (with lyrics) or preaching
              </p>
            </button>

            <button
              type="button"
              onClick={() => setUploadFormat('album')}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                uploadFormat === 'album'
                  ? 'border-violet-400 bg-violet-500/15 text-white'
                  : 'border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Disc3 className="w-4 h-4 text-violet-400" />
                Full Album / EP
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Album cover art + track titles &amp; lyrics
              </p>
            </button>
          </div>

          {/* Release Timing Toggle */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setReleaseMode('instant')}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                releaseMode === 'instant'
                  ? 'border-emerald-400 bg-emerald-500/15 text-white'
                  : 'border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Zap className="w-4 h-4 text-emerald-400" />
                Instant Release
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Auto-publishes once Admin pre-listens &amp; approves
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setReleaseMode('premiere');
                if (!premiereLocalDt) setPremiereLocalDt(minPremiereDate);
              }}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                releaseMode === 'premiere'
                  ? 'border-amber-400 bg-amber-500/15 text-white'
                  : 'border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Calendar className="w-4 h-4 text-amber-400" />
                Scheduled Premiere
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Min 7 days ahead • Cover art &amp; live countdown
              </p>
            </button>
          </div>

          {/* Release Title & Stage Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {uploadFormat === 'album' ? 'Album Title *' : 'Track / Sermon Title *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  uploadFormat === 'album'
                    ? 'e.g. Osoro Asomdwoe (Vol. 1)'
                    : 'e.g. Onyame Wo Tumi'
                }
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Artiste / Choir / SACSU Name *
              </label>
              <input
                type="text"
                required
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Obogu Seth / KNUST SACSU"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {uploadFormat === 'album' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Album Description / Liner Notes (Optional)
              </label>
              <input
                type="text"
                value={albumDescription}
                onChange={(e) => setAlbumDescription(e.target.value)}
                placeholder="e.g. 8-track Sabbath worship album recorded live..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          {/* Category & Choir Collection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'Songs' | 'Sermons' | 'Recordings')}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="Songs">Songs</option>
                <option value="Sermons">Sermons / Preachings</option>
                <option value="Recordings">Live Recordings</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Choir / Collection
              </label>
              <select
                value={choirGroup}
                onChange={(e) => setChoirGroup(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                {CHOIR_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sermon Specific Filters when Category === Sermons */}
          {category === 'Sermons' && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3.5 space-y-2.5">
              <p className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                Sermon Preacher, Bible Book &amp; Topic Tags (Optional)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={preacherName}
                  onChange={(e) => setPreacherName(e.target.value)}
                  placeholder="Preacher (e.g. Op. Abraham)"
                  className="rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                />
                <input
                  type="text"
                  value={sermonTopic}
                  onChange={(e) => setSermonTopic(e.target.value)}
                  placeholder="Topic (e.g. Sabbath Teaching)"
                  className="rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                />
                <input
                  type="text"
                  value={bibleBook}
                  onChange={(e) => setBibleBook(e.target.value)}
                  placeholder="Bible Book (e.g. Romans)"
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

          {/* Cover Art */}
          <div>
            <label
              className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs cursor-pointer transition ${
                uploadFormat === 'album' || releaseMode === 'premiere'
                  ? 'border-amber-400/60 bg-zinc-950 text-amber-200 hover:border-amber-400'
                  : 'border-white/10 bg-zinc-950 text-zinc-300 hover:border-white/25'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="truncate font-semibold">
                {coverFile
                  ? `Selected Artwork: ${coverFile.name}`
                  : uploadFormat === 'album'
                  ? 'Upload General Album Cover Art (Required for Albums) *'
                  : releaseMode === 'premiere'
                  ? 'Upload Premiere Cover Art (Required for Premieres) *'
                  : 'Upload Song Cover Art (Optional — .jpg, .png, .webp)'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          {/* Premiere Date Picker */}
          {releaseMode === 'premiere' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
              <label className="block text-xs font-bold text-amber-300">
                Premiere Date &amp; Time (At least 7 days from submission) *
              </label>
              <input
                type="datetime-local"
                required
                min={minPremiereDate}
                value={premiereLocalDt}
                onChange={(e) => setPremiereLocalDt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          )}

          {/* SINGLE AUDIO + LYRICS vs ALBUM TRACKLIST + PER-TRACK LYRICS */}
          {uploadFormat === 'single' ? (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-zinc-950/70 px-4 py-4 text-center hover:border-amber-500/50 transition cursor-pointer">
                <Music className="w-6 h-6 text-amber-400 mb-1" />
                <span className="text-sm font-medium text-zinc-200">
                  {audioFile ? audioFile.name : 'Select Audio File (.mp3, .m4a, .wav) *'}
                </span>
                <span className="text-xs text-zinc-500 mt-0.5">
                  {audioFile
                    ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB • ${formatDuration(
                        detectedDuration
                      )}`
                    : 'Admin will pre-listen before approving'}
                </span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.ogg"
                  onChange={handleSingleAudioChange}
                  className="hidden"
                />
              </label>

              {/* Song Lyrics Upload (Text OR Any Lyrics File Format!) */}
              <div className="rounded-xl border border-amber-400/25 bg-zinc-950/80 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-extrabold text-white">
                      Song Lyrics (Optional — Text or Any Lyrics File)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={lyricsLanguage}
                      onChange={(e) => setLyricsLanguage(e.target.value)}
                      className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 text-[11px] text-white"
                    >
                      <option value="Twi">Twi</option>
                      <option value="Twi & English">Twi &amp; English</option>
                      <option value="English">English</option>
                      <option value="Other">Other</option>
                    </select>

                    <label className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-400/35 hover:bg-amber-500/30 px-3 py-1 text-[11px] font-bold text-amber-300 cursor-pointer">
                      <FileText className="w-3.5 h-3.5" />
                      Upload Lyrics File
                      <input
                        type="file"
                        accept={SUPPORTED_LYRICS_EXTENSIONS}
                        onChange={handleSingleLyricsFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {lyricsFileNotice && (
                  <p className="text-[11px] font-semibold text-emerald-300">
                    ✓ {lyricsFileNotice}
                  </p>
                )}

                <textarea
                  rows={4}
                  value={lyricsRaw}
                  onChange={(e) => {
                    setLyricsRaw(e.target.value);
                    setLyricsTimed(null);
                  }}
                  placeholder="Paste Twi / English lyrics here OR click 'Upload Lyrics File' above (.lrc, .srt, .vtt, .txt, .docx, .rtf, .ttml, .json)..."
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-violet-500/30 bg-zinc-950/80 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold text-white">
                    Album Tracklist ({albumTracks.length} tracks) *
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Customize each track&apos;s title &amp; optionally attach lyrics (text or file)
                  </p>
                </div>

                <label className="inline-flex items-center gap-1.5 rounded-full bg-violet-500 hover:bg-violet-400 px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer transition">
                  <Plus className="w-3.5 h-3.5" />
                  Add Audio Tracks
                  <input
                    type="file"
                    multiple
                    accept="audio/*,.mp3,.m4a,.wav,.ogg"
                    onChange={handleAddAlbumFiles}
                    className="hidden"
                  />
                </label>
              </div>

              {albumTracks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-xs text-zinc-500">
                  No tracks added yet. Click &ldquo;Add Audio Tracks&rdquo; to select 2 or more
                  songs for this album.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {albumTracks.map((trk, idx) => (
                    <div
                      key={trk.id}
                      className="rounded-xl border border-white/10 bg-zinc-900 p-2.5 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-xs font-extrabold text-amber-400 tabular-nums">
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          required
                          value={trk.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAlbumTracks((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, title: val } : x))
                            );
                          }}
                          placeholder={`Track ${idx + 1} Title`}
                          className="flex-1 rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAlbumTracks((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, showLyricsEditor: !x.showLyricsEditor } : x
                              )
                            )
                          }
                          className={`rounded-lg px-2 py-1 text-[10px] font-bold cursor-pointer ${
                            trk.lyricsRaw?.trim()
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-white/10 text-amber-300 hover:bg-white/15'
                          }`}
                        >
                          {trk.lyricsRaw?.trim() ? 'Lyrics ✓' : '+ Lyrics'}
                        </button>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveAlbumTrack(idx, -1)}
                            className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === albumTracks.length - 1}
                            onClick={() => moveAlbumTrack(idx, 1)}
                            className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAlbumTracks((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {trk.showLyricsEditor && (
                        <div className="space-y-1.5 pt-1 border-t border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400">
                              Paste lyrics or upload file (.lrc, .srt, .vtt, .txt, .docx)
                            </span>
                            <label className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 cursor-pointer">
                              Import File
                              <input
                                type="file"
                                accept={SUPPORTED_LYRICS_EXTENSIONS}
                                className="hidden"
                                onChange={async (ev) => {
                                  const f = ev.target.files?.[0];
                                  if (!f) return;
                                  try {
                                    const res = await parseLyricsFile(f);
                                    setAlbumTracks((prev) =>
                                      prev.map((x, i) =>
                                        i === idx
                                          ? {
                                              ...x,
                                              lyricsRaw: res.lyricsText,
                                              lyricsTimed: res.lyricsTimed,
                                              lyricsFormat: res.detectedFormat,
                                            }
                                          : x
                                      )
                                    );
                                  } catch {
                                    // ignore
                                  }
                                }}
                              />
                            </label>
                          </div>
                          <textarea
                            rows={2}
                            value={trk.lyricsRaw || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAlbumTracks((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, lyricsRaw: val, lyricsTimed: null } : x
                                )
                              );
                            }}
                            placeholder="Type or paste lyrics for this track..."
                            className="w-full rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <label className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-xs text-violet-200 cursor-pointer">
              <input
                type="checkbox"
                checked={adminAutoApprove}
                onChange={(e) => setAdminAutoApprove(e.target.checked)}
                className="rounded accent-amber-500"
              />
              <ShieldCheck className="w-4 h-4 text-violet-400" />
              Approve immediately (Master Admin privilege)
            </label>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={
              uploading || (uploadFormat === 'single' ? !audioFile : albumTracks.length < 2)
            }
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {progressText || 'Uploading...'}
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                {uploadFormat === 'album'
                  ? releaseMode === 'premiere'
                    ? `Submit Album Premiere (${albumTracks.length} Tracks)`
                    : `Submit Full Album (${albumTracks.length} Tracks)`
                  : releaseMode === 'premiere'
                  ? 'Submit Song Premiere for Approval'
                  : 'Submit Track for Approval'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
