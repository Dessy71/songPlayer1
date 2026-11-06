import { TimedLyricLine } from '../types/music';

export interface ParsedLyricsResult {
  lyricsText: string;
  lyricsTimed: TimedLyricLine[] | null;
  detectedFormat: string;
}

export const SUPPORTED_LYRICS_EXTENSIONS =
  '.txt,.lrc,.elrc,.srt,.vtt,.sbv,.ass,.ssa,.ttml,.xml,.dfxp,.json,.rtf,.md,.docx,.csv';

function parseClockToSeconds(clock: string): number | null {
  const clean = clock.trim().replace(',', '.');
  // Matches hh:mm:ss.xx or mm:ss.xx or ss.xx
  const parts = clean.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return null;
}

function parseLrc(raw: string): ParsedLyricsResult | null {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const timed: TimedLyricLine[] = [];
  const plainLines: string[] = [];

  const timeTagRegex = /\[(\d{1,2}:\d{2}(?:[.:]\d{1,3})?)\]/g;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      plainLines.push('');
      continue;
    }
    // Skip LRC metadata tags like [ar:...], [ti:...], [al:...], [by:...], [offset:...]
    if (/^\[(ar|ti|al|au|length|by|offset|re|ve):/i.test(trimmed)) {
      continue;
    }

    const matches = [...trimmed.matchAll(timeTagRegex)];
    if (matches.length > 0) {
      // Strip inline word timestamps like <00:14.22> and outer [00:12.00]
      const cleanLyric = trimmed
        .replace(timeTagRegex, '')
        .replace(/<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/g, '')
        .trim();

      for (const m of matches) {
        const normalizedClock = m[1].replace(/^(\d+:\d+):(\d+)$/, '$1.$2');
        const secs = parseClockToSeconds(normalizedClock);
        if (secs !== null && cleanLyric) {
          timed.push({ time: Number(secs.toFixed(2)), text: cleanLyric });
        }
      }
      if (cleanLyric) plainLines.push(cleanLyric);
    } else {
      plainLines.push(trimmed);
    }
  }

  if (timed.length === 0) return null;
  timed.sort((a, b) => a.time - b.time);

  return {
    lyricsText: plainLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    lyricsTimed: timed,
    detectedFormat: 'lrc',
  };
}

function parseSrtOrVtt(raw: string, formatName: 'srt' | 'vtt' | 'sbv'): ParsedLyricsResult | null {
  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/^WEBVTT[^\n]*\n+/i, '')
    .trim();

  const blocks = normalized.split(/\n\s*\n/);
  const timed: TimedLyricLine[] = [];
  const plain: string[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    let startSec: number | null = null;

    for (let i = 0; i < Math.min(2, lines.length); i++) {
      // SRT / VTT: 00:00:12,500 --> 00:00:16,000
      const arrowMatch = lines[i].match(
        /^(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}|\d{1,2}:\d{2}(?::\d{2})?)\s*-->/
      );
      if (arrowMatch) {
        startSec = parseClockToSeconds(arrowMatch[1]);
        timeLineIdx = i;
        break;
      }
      // YouTube SBV: 0:00:12.500,0:00:16.000
      const sbvMatch = lines[i].match(
        /^(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}),\s*\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}$/
      );
      if (sbvMatch) {
        startSec = parseClockToSeconds(sbvMatch[1]);
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx >= 0 && startSec !== null) {
      const textPart = lines
        .slice(timeLineIdx + 1)
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .trim();
      if (textPart) {
        timed.push({ time: Number(startSec.toFixed(2)), text: textPart });
        plain.push(textPart);
      }
    }
  }

  if (timed.length === 0) return null;
  timed.sort((a, b) => a.time - b.time);
  return {
    lyricsText: plain.join('\n'),
    lyricsTimed: timed,
    detectedFormat: formatName,
  };
}

function parseAssSubtitles(raw: string): ParsedLyricsResult | null {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const timed: TimedLyricLine[] = [];
  const plain: string[] = [];

  for (const line of lines) {
    if (!line.startsWith('Dialogue:')) continue;
    // Dialogue: 0,0:00:12.34,0:00:15.60,Default,,0,0,0,,Actual lyric text
    const parts = line.slice(9).split(',');
    if (parts.length < 10) continue;
    const secs = parseClockToSeconds(parts[1]);
    const text = parts
      .slice(9)
      .join(',')
      .replace(/\{[^}]*\}/g, '')
      .replace(/\\N/gi, ' ')
      .trim();
    if (secs !== null && text) {
      timed.push({ time: Number(secs.toFixed(2)), text });
      plain.push(text);
    }
  }

  if (timed.length === 0) return null;
  timed.sort((a, b) => a.time - b.time);
  return {
    lyricsText: plain.join('\n'),
    lyricsTimed: timed,
    detectedFormat: 'ass',
  };
}

function parseXmlOrTtml(raw: string): ParsedLyricsResult | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const pNodes = Array.from(doc.querySelectorAll('p, line, lyric, text'));
    const timed: TimedLyricLine[] = [];
    const plain: string[] = [];

    for (const node of pNodes) {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const beginAttr =
        node.getAttribute('begin') ||
        node.getAttribute('start') ||
        node.getAttribute('time');
      if (beginAttr) {
        const cleanBegin = beginAttr.endsWith('s') ? beginAttr.slice(0, -1) : beginAttr;
        const secs = parseClockToSeconds(cleanBegin);
        if (secs !== null) {
          timed.push({ time: Number(secs.toFixed(2)), text });
        }
      }
      plain.push(text);
    }

    if (plain.length === 0) {
      const bodyText = (doc.documentElement.textContent || '').trim();
      if (!bodyText) return null;
      return { lyricsText: bodyText, lyricsTimed: null, detectedFormat: 'xml' };
    }

    return {
      lyricsText: plain.join('\n'),
      lyricsTimed: timed.length > 0 ? timed.sort((a, b) => a.time - b.time) : null,
      detectedFormat: 'ttml',
    };
  } catch {
    return null;
  }
}

function parseJsonLyrics(raw: string): ParsedLyricsResult | null {
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.lines)
      ? parsed.lines
      : Array.isArray(parsed?.lyrics)
      ? parsed.lyrics
      : null;

    if (arr) {
      const timed: TimedLyricLine[] = [];
      const plain: string[] = [];
      for (const item of arr) {
        if (typeof item === 'string') {
          plain.push(item);
        } else if (item && typeof item === 'object') {
          const text = String(item.text ?? item.words ?? item.line ?? '').trim();
          if (!text) continue;
          plain.push(text);
          if (typeof item.time === 'number') {
            timed.push({ time: item.time, text });
          } else if (item.startTimeMs !== undefined) {
            timed.push({ time: Number(item.startTimeMs) / 1000, text });
          }
        }
      }
      return {
        lyricsText: plain.join('\n').trim(),
        lyricsTimed: timed.length > 0 ? timed.sort((a, b) => a.time - b.time) : null,
        detectedFormat: 'json',
      };
    }

    if (typeof parsed?.lyrics === 'string') {
      return parseLyricsInput(parsed.lyrics, 'txt');
    }
    return null;
  } catch {
    return null;
  }
}

function stripRtf(raw: string): string {
  return raw
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\line/g, '\n')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-z]+-?\d*\s?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts text from a Microsoft Word (.docx) file directly in the browser
 * by reading word/document.xml from the ZIP archive using DecompressionStream.
 */
async function extractDocxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  let offset = 0;
  while (offset + 30 < bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Local file header signature

    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLen);
    const entryName = new TextDecoder().decode(nameBytes);
    const dataStart = offset + 30 + fileNameLen + extraLen;
    const dataEnd = dataStart + compressedSize;

    if (entryName === 'word/document.xml' && dataEnd <= bytes.length) {
      const slice = bytes.subarray(dataStart, dataEnd);
      let xmlText = '';
      if (compression === 0) {
        xmlText = new TextDecoder().decode(slice);
      } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(slice);
        writer.close();
        const decompressed = await new Response(ds.readable).arrayBuffer();
        xmlText = new TextDecoder().decode(decompressed);
      }

      if (xmlText) {
        const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        const paragraphs = Array.from(doc.getElementsByTagName('w:p'));
        const lines = paragraphs
          .map((p) =>
            Array.from(p.getElementsByTagName('w:t'))
              .map((t) => t.textContent || '')
              .join('')
              .trim()
          )
          .join('\n');
        return lines.replace(/\n{3,}/g, '\n\n').trim();
      }
    }

    offset = dataEnd;
  }

  throw new Error('Could not extract text from .docx file. Please save as .txt or paste the text directly.');
}

export function parseLyricsInput(rawText: string, formatHint = 'text'): ParsedLyricsResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { lyricsText: '', lyricsTimed: null, detectedFormat: 'text' };
  }

  const ext = formatHint.toLowerCase().replace(/^\./, '');

  if (ext === 'rtf' || trimmed.startsWith('{\\rtf')) {
    return {
      lyricsText: stripRtf(trimmed),
      lyricsTimed: null,
      detectedFormat: 'rtf',
    };
  }

  if (ext === 'json' || (trimmed.startsWith('{') || trimmed.startsWith('['))) {
    const jsonRes = parseJsonLyrics(trimmed);
    if (jsonRes) return jsonRes;
  }

  if (ext === 'ttml' || ext === 'xml' || ext === 'dfxp' || trimmed.startsWith('<?xml') || trimmed.startsWith('<tt')) {
    const xmlRes = parseXmlOrTtml(trimmed);
    if (xmlRes) return xmlRes;
  }

  if (ext === 'ass' || ext === 'ssa' || trimmed.includes('[Events]')) {
    const assRes = parseAssSubtitles(trimmed);
    if (assRes) return assRes;
  }

  if (ext === 'vtt' || trimmed.startsWith('WEBVTT')) {
    const vttRes = parseSrtOrVtt(trimmed, 'vtt');
    if (vttRes) return vttRes;
  }

  if (ext === 'srt' || ext === 'sbv' || /\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s*-->/.test(trimmed)) {
    const srtRes = parseSrtOrVtt(trimmed, ext === 'sbv' ? 'sbv' : 'srt');
    if (srtRes) return srtRes;
  }

  // Auto-detect LRC timestamps even if pasted directly into the text box!
  const lrcRes = parseLrc(trimmed);
  if (lrcRes) return lrcRes;

  return {
    lyricsText: trimmed.replace(/\r\n/g, '\n'),
    lyricsTimed: null,
    detectedFormat: ext || 'text',
  };
}

export async function parseLyricsFile(file: File): Promise<ParsedLyricsResult> {
  const ext = (file.name.split('.').pop() || 'txt').toLowerCase();
  if (ext === 'docx') {
    const extracted = await extractDocxText(file);
    return parseLyricsInput(extracted, 'docx');
  }
  const raw = await file.text();
  return parseLyricsInput(raw, ext);
}
