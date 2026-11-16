/**
 * Gyidi Nnwom — investor prototype data.
 *
 * A snapshot of the LIVE database, taken 2026-11-11. Titles, artiste names,
 * choir groups, avatars and the headline counters are all real; nothing here is
 * invented except per-song durations, which the schema does not store.
 *
 * Loaded as a plain script (not a module) so index.html opens straight from
 * disk with no server and no build step.
 */
(function () {
  'use strict';

  var COVERS = ['covers/cover-1.jpg', 'covers/cover-2.jpg', 'covers/cover-3.jpg'];

  /** FNV-1a — identical to src/lib/defaultCovers.ts, so covers match the live app. */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function coverFor(title) {
    var seed = String(title || '').trim().toLowerCase();
    return seed ? COVERS[hash(seed) % COVERS.length] : COVERS[0];
  }

  var ARTISTES = [
    { id: '58b95b0b', name: 'Obogu Seth', zone: 'Obogu Zone', branch: 'Obogu Branch', tier: 'artiste', verified: true, avatar: 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/avatars/artiste-1794209958902.jpeg' },
    { id: '93fbda66', name: 'Greater Accra Boysco_KOJO', zone: 'Greater Accra Zone', branch: 'Accra Branch', tier: 'artiste', verified: true, avatar: 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/avatars/artiste-1794209913264.jpeg' },
    { id: '43f1c49d', name: 'Yaw Baidoo', zone: 'Ashanti Zone', branch: 'SCG Branch', tier: 'artiste', verified: false, avatar: null },
    { id: '9eea14f1', name: 'Op. Abraham', zone: 'Okyeman Zone', branch: 'Osiem Headquarters', tier: 'artiste', verified: true, avatar: 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/avatars/artiste-1794212983363.jpeg' },
    { id: '93fdfca2', name: 'K. Badu (Sekyere)', zone: 'Sekyere Zone', branch: 'Sekyere Branch', tier: 'artiste', verified: false, avatar: 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/avatars/93fdfca2-aa25-4e6f-ab40-5092a6dbc5c7-1794040191996.jpeg' },
    { id: '60fe740c', name: 'Kumawu Choir', zone: 'Kumawu Zone', branch: 'Kumawu Branch', tier: 'artiste', verified: false, avatar: null },
    { id: '1d460321', name: 'Mponua Choir', zone: 'Mponua Zone', branch: 'Mponua Branch', tier: 'artiste', verified: false, avatar: null },
    { id: '38bb5fa2', name: 'Bosiako', zone: 'Ashanti Zone', branch: 'Bosiako Branch', tier: 'artiste', verified: false, avatar: null },
    { id: '685da210', name: 'Chairman Oboy', zone: 'Okyeman Zone', branch: 'Osiem Headquarters', tier: 'artiste', verified: false, avatar: 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/avatars/artiste-1794372313724.jpeg' },
    { id: 'ecaad9a9', name: 'gina vocals', zone: 'Accra', branch: 'tabora', tier: 'artiste', verified: false, avatar: 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/avatars/artiste-1794034928237.jpeg' },
    { id: '9b644989', name: 'Blacko', zone: 'Accra', branch: 'Taboraa', tier: 'artiste', verified: false, avatar: 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/avatars/9b644989-320e-469c-97f5-d7c9e821ebce-1794063931208.jpeg' },
    { id: '5314aad9', name: 'SACSU Fellowship', zone: 'National SACSU', branch: 'Tertiary Students Wing', tier: 'artiste', verified: true, sacsu: true, avatar: null },
    { id: '59431ef3', name: 'kofi kay', zone: 'Ashanti Zone', branch: 'Tabora', tier: 'admin', verified: true, avatar: 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/avatars/59431ef3-7f64-4e94-a1eb-b49446826ad3-1793959273186.jpeg' }
  ];

  // `sec` is illustrative — the schema stores no duration.
  var SONGS = [
    { id: 'c6f7f48f', title: 'Adehye Mma', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 254 },
    { id: '2a654920', title: 'Adom Bra', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 231 },
    { id: '46cb87ea', title: 'Ayeyi Bɛn', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 268 },
    { id: 'bbbf6171', title: 'Bobetro', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: 'Twi', sec: 245 },
    { id: '2d19a71a', title: 'Daniel', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 302 },
    { id: '0ac89d38', title: 'ewiase mu amane', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 219 },
    { id: '1072ec8c', title: 'ɛna me man ne mo', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 276 },
    { id: '41deea45', title: 'ɛsono ɔsofo ɛna ɛsono ɔsomafo', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 288 },
    { id: '1544a203', title: 'ɛyɛ hena ni', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 234 },
    { id: 'f31a58e3', title: "Fa W'Ani Bɛ hwɛ", artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 261 },
    { id: 'b66a49de', title: 'Gethsemane', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 295 },
    { id: 'eb9d50b0', title: 'Gyae su Yohane', artist: 'Obogu Seth', choir: 'Obogu Choir', cat: 'Songs', lang: null, sec: 242 },
    { id: 'e86403b9', title: 'Eli, Eli, lama sabachthani?', artist: 'Greater Accra Boysco_KOJO', choir: 'Accra Choir', cat: 'Songs', lang: null, sec: 313, cover: 'https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/art/eli-eli-lama-sabachthani--mwaf57td.png' },
    { id: '802ee6ab', title: 'Aduru me so', artist: 'Greater Accra Boysco_KOJO', choir: 'Accra Choir', cat: 'Songs', lang: null, sec: 227 },
    { id: 'd23697f8', title: 'Amanman mu somafoɔ', artist: 'Greater Accra Boysco_KOJO', choir: 'Accra Choir', cat: 'Songs', lang: null, sec: 249 },
    { id: '7611ee9b', title: 'Bisa Biribi me Dim Mo', artist: 'Greater Accra Boysco_KOJO', choir: 'Accra Choir', cat: 'Songs', lang: 'Twi', sec: 283 },
    { id: 'e9c37524', title: 'Awiseea, adɛ owuo ayɛ me', artist: 'Greater Accra Boysco_KOJO', choir: 'Accra Choir', cat: 'Songs', lang: null, sec: 271 },
    { id: 'adc2f821', title: 'ewiase nyinaaa mbɛhwɛ me', artist: 'Greater Accra Boysco_KOJO', choir: 'Accra Choir', cat: 'Songs', lang: null, sec: 238 },
    { id: '133a451f', title: 'Bobetro', artist: 'Yaw Baidoo', choir: 'Yaw Baidoo', cat: 'Songs', lang: 'Twi', sec: 256 },
    { id: '91cc649e', title: 'Bobetro', artist: 'Yaw Baidoo', choir: 'Yaw Baidoo', cat: 'Songs', lang: 'Twi', sec: 256 },
    { id: '823411e9', title: "Dani W'Ani Kyere me", artist: 'Yaw Baidoo', choir: 'Yaw Baidoo', cat: 'Songs', lang: 'Twi', sec: 265 },
    { id: '93a7ff59', title: 'Etwa Se Onipa Bewu', artist: 'Yaw Baidoo', choir: 'Yaw Baidoo', cat: 'Songs', lang: 'Twi', sec: 279 },
    { id: '5bb083e2', title: 'Akoapa Nokwafo Mo', artist: 'Mponua Choir', choir: 'Mponua Choir', cat: 'Songs', lang: 'Twi', sec: 291 },
    { id: '4726a779', title: 'Bkumawu', artist: 'Kumawu Choir', choir: 'Kumawu Choir', cat: 'Songs', lang: 'Twi', sec: 236 },
    { id: '62d282f3', title: 'Anamon Nsia Da Ho', artist: 'K. Badu (Sekyere)', choir: 'Sekyere Choir', cat: 'Songs', lang: 'Twi', sec: 247 },
    { id: '9d361fef', title: 'Bosiako (Live Recording)', artist: 'Bosiako', choir: 'Live Recordings', cat: 'Songs', lang: 'Twi', sec: 324 },
    { id: '9448d83a', title: '8 - 6 - 13 OP Abraham', artist: 'Op. Abraham', choir: 'Sermons & Teachings', cat: 'Sermons', lang: 'Twi', sec: 2742 },
    { id: 'b16f86c7', title: '(3 - 9 - 11) OP Abraham', artist: 'Op. Abraham', choir: 'Sermons & Teachings', cat: 'Sermons', lang: 'Twi', sec: 2518 },
    { id: '08c22c58', title: '@op. Abraham Preaching', artist: 'Op. Abraham', choir: 'Sermons & Teachings', cat: 'Sermons', lang: 'Twi', sec: 3105 }
  ];

  SONGS.forEach(function (s) {
    if (!s.cover) s.cover = coverFor(s.title);
  });

  var STATS = {
    songs: 289,
    sermons: 15,
    choirs: 12,
    artistes: 12,
    plays: 310,
    sessions: 85,
    listeningNow: 9,
    activeHour: 34,
    pendingApprovals: 6,
    unlinkedReleases: 190
  };

  var MESSAGES = [
    { from: 'Gyidi Nnwom', body: 'Sunday service recordings are now up — 4 new songs from Obogu Choir.', time: '2h', broadcast: true, unread: true },
    { from: 'Op. Abraham', body: 'Please approve the sermon I uploaded yesterday when you get a moment.', time: '5h', unread: true },
    { from: 'Gyidi Nnwom', body: 'Convention 2026 livestream goes out at 9am Saturday. Save the date.', time: '1d', broadcast: true, unread: false }
  ];

  var PREMIERES = [
    { title: 'Ayeyi Bɛn', artist: 'Obogu Seth', at: 'Sat 09:00', days: 2 },
    { title: 'Etwa Se Onipa Bewu', artist: 'Yaw Baidoo', at: 'Sun 18:00', days: 3 }
  ];

  var PENDING = [
    { title: 'Mesuro No', artist: 'Chairman Oboy', cat: 'Songs' },
    { title: 'Onyame Wo Tumi', artist: 'gina vocals', cat: 'Songs' },
    { title: 'Aseda Nnwom', artist: 'Blacko', cat: 'Songs' },
    { title: 'Convention Sunday Sermon', artist: 'Op. Abraham', cat: 'Sermons' }
  ];

  window.GYIDI = {
    COVERS: COVERS,
    coverFor: coverFor,
    ARTISTES: ARTISTES,
    SONGS: SONGS,
    STATS: STATS,
    MESSAGES: MESSAGES,
    PREMIERES: PREMIERES,
    PENDING: PENDING
  };
})();
