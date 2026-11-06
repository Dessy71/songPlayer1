# Gyidi Nwom — SCG & SACSU Gospel Music, Premieres & Sermon Streaming Platform

A fast, installable Progressive Web Application (**React + TypeScript + Tailwind CSS + Supabase**) built for **Savior Church of Ghana (SCG)** and **Savior Church Students' Union (SACSU)** choirs, artistes, convention teachings, and brethren worldwide.

## Key Features

- **Sub-Second Cloud Audio Streaming**: 295+ catalog tracks (~718 MB, 62.6 hours of audio) hosted on Supabase Cloud Storage (`eu-west-1`) with HTTP Range streaming, hover audio pre-warming, and `localStorage` catalog caching.
- **5-Song Guest Preview & Full Member Library**: Unauthenticated visitors can preview 5 songs with Play/Pause, Next, and Previous; free Listener accounts unlock all 295+ tracks and seeking; Premium adds Likes, Playlists, Offline Saving, Lyrics, and Sharing.
- **SCG & SACSU Artiste Profiles, Studio & Pre-Created Claim Codes**:
  - Dedicated profiles for SCG choirs/singers and SACSU campus fellowships (KNUST, UG Legon, UCC, UEW, UMaT, UENR, KsTU, etc.) with Fan Support MoMo/Bank details.
  - Pre-created Artiste profiles with Claim Codes & Master Admin credential provisioning.
- **Instant Releases & 7-Day Single / Album Premieres**:
  - Upload single tracks or multi-track albums with general cover art, individual track titles, and 7-day live countdown premieres.
- **Twi + English Song Lyrics (Text or Universal Lyrics File Upload)**:
  - Artistes and Admin can paste plain text or upload `.lrc`, `.elrc`, `.srt`, `.vtt`, `.txt`, `.docx`, `.ttml`, `.xml`, `.json`, `.rtf`, `.ass`, `.sbv`, or `.md` files.
  - Synchronized live karaoke highlighting + adjustable-font church hymnal view + full-text lyrics search.
- **Installable Mobile App (PWA) & Zero-Data Offline Vault**:
  - Installable on Android, iOS, and Desktop (`manifest.webmanifest` + Service Worker) with in-app offline MP3 caching (`CacheStorage`).
- **Sermon Explorer & Automatic Resume Playback**:
  - Filter convention and Sabbath teachings by **Preacher**, **Sermon Topic**, and **Bible Book**, with auto-saved playback progress (`Resume from mm:ss`).
- **1-Tap WhatsApp Status Poster Generator**:
  - Generates branded `1080×1920` story posters with cover art, song title, optional lyric quote, and direct stream link.
- **Upcoming Feature — Live Convention Video & Sabbath Radio Stream**:
  - Preview and early-access broadcaster/viewer waitlist for HD Live Convention Video Streaming and Low-Data Sabbath Audio Radio.
- **Master Admin Dashboard (`desmondantwi07@gmail.com`)**:
  - Stream analytics, pre-listen approval queue, direct & broadcast Artiste messaging, 7-day scheduled Daily Bible Verse Flyers, targeted Church/Platform Announcements, and Google AdSense monetization manager.
- **Support Gyidi Nwom & Meet the Developer**:
  - **Support Gyidi Nwom**: `MTN Mobile Money (MoMo)` • `0557394159` • `Desmond Kofi Antwi`
  - **Meet the Developer**: [https://desmondantwi.vercel.app/](https://desmondantwi.vercel.app/)

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Premium billing and cross-device recovery

See [the payment operations guide](docs/payments.md) for webhook configuration, deployment, security model, recovery and rollout tests.

- Checkout is initialized server-side using admin-configured monthly/yearly GHS prices.
- Orders are stored against the authenticated Supabase account ID before payment. Restoring access on another device requires signing in to that same account, not a transaction ID or browser storage.
- A signed Paystack webhook verifies every successful payment through Paystack's API before atomic subscription activation. Browser callbacks are never proof of payment.
- Existing subscription receipts, admin lifetime grants, billing history, and optional legacy reference recovery are retained.
- Plans remain prepaid monthly/yearly memberships, not recurring direct debits.
- Offline audio stays in browser-managed app storage on each device. The account's saved track list syncs centrally, but audio must be cached on each new device.

```bash
npm test
npm run build
```
