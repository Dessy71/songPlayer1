# Gyidi Nwom — SCG & SACSU Gospel Music, Premieres & Sermon Streaming Platform

A fast, installable Progressive Web Application (**React + TypeScript + Tailwind CSS + Supabase**) built for **Savior Church of Ghana (SCG)** and **Savior Church Students' Union (SACSU)** choirs, artistes, convention teachings, and brethren worldwide.

## Key Features

- **Sub-Second Cloud Audio Streaming**: 295+ catalog tracks (~718 MB, 62.6 hours of audio) hosted on Supabase Cloud Storage (`eu-west-1`) with HTTP Range streaming, hover audio pre-warming, and `localStorage` catalog caching.
- **5-Song Guest Preview & Full Member Library**: Unauthenticated visitors can preview 5 songs with Play/Pause, Next, and Previous; free Listener accounts unlock all 295+ tracks, Likes, Playlists, Seeking, Offline Saving, and Lyrics.
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

## Premium billing configuration (Phase 7)

- Master Admin → Premium & Paystack: set the Paystack **public** key and monthly/yearly GHS prices (defaults: GHS 5 / GHS 50).
- Supabase → Edge Function Secrets: configure `PAYSTACK_SECRET_KEY` securely. Never place the secret in Vite variables, the settings table, or source control.
- `verify-premium-payment` checks the authenticated user, Paystack success status, currency, exact amount, account email and plan/user metadata before allowing activation. Client callbacks alone cannot grant Premium. References cannot extend a membership twice.
- Plans currently use prepaid, manually renewed monthly/yearly access, not recurring direct debits. Live Video/Radio remains an upcoming feature; Premium does not imply a live broadcast is available today.
- Offline Save keeps audio in browser-managed in-app storage on the current device, not in Downloads. The saved track list syncs to the account; another device still needs to cache the stream. Browser storage eviction can remove offline audio.
- Payments cannot be fully tested until both Paystack keys are configured. Use matching test keys first, verify success/cancellation/duplicate-reference behavior, then switch to matching live keys.

### Recover a charged payment that did not activate Premium

1. Set the matching Paystack secret key securely in Supabase → Edge Functions → Secrets as `PAYSTACK_SECRET_KEY` (live secret for a live charge). Do not paste secrets into chat or frontend settings.
2. Sign in to the same Gyidi Nwom account used at checkout.
3. Open Premium & Billing → **Already paid? Verify existing payment**, paste the transaction reference from the Paystack receipt, select the plan paid for, and verify. This does not make a new charge.
4. Only a server-verified active profile triggers the confetti success dialog. The app reloads after 3.5 seconds to refresh account entitlements.

Failed callback references are retained locally per account for retry. Checkout checks verifier configuration before opening Paystack. Lyrics and song sharing are Premium features.

Payment helper regression tests: `node --experimental-vm-modules --test tests/premiumPayment.test.mjs`.
