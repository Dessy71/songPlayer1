import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { Song } from '../types/music';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  initialQuote?: string;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  song,
  initialQuote = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [quote, setQuote] = useState(initialQuote);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen && song) {
      const defaultLyric =
        initialQuote ||
        song.lyrics_text
          ?.split('\n')
          .map((l) => l.trim())
          .find((l) => l.length >= 10 && l.length <= 120) ||
        '';
      setQuote(defaultLyric);
    }
  }, [isOpen, song, initialQuote]);

  useEffect(() => {
    if (!isOpen || !song || !canvasRef.current) return;

    let cancelled = false;
    const renderCard = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = 1080;
      const H = 1920;
      canvas.width = W;
      canvas.height = H;

      // 1. Rich Sacred Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#181024');
      bgGrad.addColorStop(0.45, '#09090b');
      bgGrad.addColorStop(1, '#1c1208');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Decorative Golden Glow
      const radial = ctx.createRadialGradient(W / 2, 540, 60, W / 2, 540, 620);
      radial.addColorStop(0, 'rgba(245, 158, 11, 0.34)');
      radial.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, W, H);

      // Outer Card Frame
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 4;
      ctx.strokeRect(56, 56, W - 112, H - 112);

      // 2. Top Brand Pill
      ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.beginPath();
      ctx.roundRect(330, 120, 420, 68, 34);
      ctx.fill();

      ctx.fillStyle = '#fcd34d';
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✨ GYIDI NWOM STREAMING', W / 2, 164);

      // 3. Cover Art Box (640x640)
      const artSize = 620;
      const artX = (W - artSize) / 2;
      const artY = 250;

      let drewCover = false;
      if (song.cover_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('img load err'));
            img.src = song.cover_url!;
          });
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(artX, artY, artSize, artSize, 48);
          ctx.clip();
          ctx.drawImage(img, artX, artY, artSize, artSize);
          ctx.restore();
          drewCover = true;
        } catch {
          drewCover = false;
        }
      }

      if (!drewCover) {
        const artGrad = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
        artGrad.addColorStop(0, '#f59e0b');
        artGrad.addColorStop(0.5, '#db2777');
        artGrad.addColorStop(1, '#6d28d9');
        ctx.fillStyle = artGrad;
        ctx.beginPath();
        ctx.roundRect(artX, artY, artSize, artSize, 48);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = '800 180px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((song.title[0] || 'G').toUpperCase(), W / 2, artY + 380);
      }

      // 4. Song Title & Artiste
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 62px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      const titleLines = wrapCanvasText(ctx, song.title, 880, 2);
      let cursorY = 980;
      for (const line of titleLines) {
        ctx.fillText(line, W / 2, cursorY);
        cursorY += 76;
      }

      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 38px Inter, sans-serif';
      ctx.fillText(song.artist, W / 2, cursorY + 18);
      cursorY += 90;

      // 5. Optional Highlighted Lyric / Quote Box
      if (quote.trim()) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.roundRect(100, cursorY + 20, W - 200, 340, 36);
        ctx.fill();

        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'italic 600 38px Inter, sans-serif';
        const qLines = wrapCanvasText(ctx, `"${quote.trim()}"`, W - 280, 4);
        let qY = cursorY + 110;
        for (const ql of qLines) {
          ctx.fillText(ql, W / 2, qY);
          qY += 58;
        }
      }

      // 6. Footer CTA
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '600 30px Inter, sans-serif';
      ctx.fillText('Listen to SCG Hymns, Choirs & Sermons on', W / 2, H - 190);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 36px Plus Jakarta Sans, sans-serif';
      ctx.fillText(window.location.host, W / 2, H - 135);

      if (!cancelled) {
        try {
          setPreviewDataUrl(canvas.toDataURL('image/png'));
        } catch {
          setPreviewDataUrl(null);
        }
      }
    };

    renderCard();
    return () => {
      cancelled = true;
    };
  }, [isOpen, song, quote]);

  if (!isOpen || !song) return null;

  const deepLink = `${window.location.origin}/?track=${encodeURIComponent(song.slug || song.id)}`;
  const waText = `🎵 *${song.title}* — _${song.artist}_${
    quote.trim() ? `\n\n"${quote.trim()}"` : ''
  }\n\nListen now on *Gyidi Nwom*:\n${deepLink}`;

  const handleNativeOrWhatsAppShare = async () => {
    try {
      if (navigator.share && canvasRef.current) {
        const blob = await new Promise<Blob | null>((res) =>
          canvasRef.current?.toBlob((b) => res(b), 'image/png')
        );
        if (blob) {
          const file = new File([blob], `${song.slug || 'gyidi'}-status.png`, {
            type: 'image/png',
          });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${song.title} — Gyidi Nwom`,
              text: waText,
              files: [file],
            });
            return;
          }
        }
      }
    } catch {
      // Fallback to WhatsApp link below
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, '_blank', 'noopener');
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/15 bg-zinc-950 p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto stable-scroll">
        <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
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

        <div className="flex items-center gap-2.5 mb-4">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white">
              1-Tap WhatsApp Status Card Generator
            </h3>
            <p className="text-xs text-zinc-400">
              Share a branded poster & direct stream link to WhatsApp Status or church groups
            </p>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
          <div className="sm:col-span-5 flex justify-center">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="WhatsApp Status Poster Preview"
                className="max-h-80 rounded-2xl border border-white/15 shadow-2xl object-contain"
              />
            ) : (
              <div className="h-72 w-44 rounded-2xl bg-zinc-900 animate-pulse" />
            )}
          </div>

          <div className="sm:col-span-7 space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Highlight Lyric / Message on Card (Optional)
              </label>
              <textarea
                rows={2}
                maxLength={140}
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Type a favorite Twi/English lyric line or Sabbath blessing..."
                className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <button
              onClick={handleNativeOrWhatsAppShare}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3 text-xs font-extrabold text-zinc-950 shadow-lg cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              Share to WhatsApp / Status
            </button>

            <button
              onClick={async () => {
                await navigator.clipboard.writeText(deepLink);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 py-2.5 text-xs font-bold text-white cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  Copy Song Link
                </>
              )}
            </button>

            <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              On Android &amp; iPhone, &ldquo;Share to WhatsApp&rdquo; attaches both the Status poster image and clickable song link!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
