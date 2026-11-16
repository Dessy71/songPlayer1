/* ===========================================================================
   Gyidi Nnwom — clickable iPhone prototype
   Vanilla JS, no build step. 28 screens, working tab bar, mini + full player,
   lyrics and queue sheets. Content is a real snapshot of the live database.
   =========================================================================== */
(function () {
  'use strict';

  var D = window.GYIDI;
  var SONGS = D.SONGS;
  var ARTISTES = D.ARTISTES;
  var S = D.STATS;

  var el = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* --- icon set (mirrors lucide-react, used by the real app) -------------- */

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>',
    flame: '<path d="M12 2s4.5 4.2 4.5 8.4a4.5 4.5 0 01-9 0C7.5 6.2 12 2 12 2z"/><path d="M12 21a6 6 0 006-6c0-3-2-5-2-5"/>',
    sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/><path d="M18 16.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/>',
    live: '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 000 8.4M16.2 16.2a6 6 0 000-8.4"/><path d="M4.9 4.9a10 10 0 000 14.2M19.1 19.1a10 10 0 000-14.2"/>',
    disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
    mic: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    users: '<path d="M16 20v-1.5a4 4 0 00-4-4H6a4 4 0 00-4 4V20"/><circle cx="9" cy="7" r="3.5"/><path d="M22 20v-1.5a4 4 0 00-3-3.87M16.5 3.6a4 4 0 010 6.8"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 016.5 2H20v18H6.5A2.5 2.5 0 004 22V4.5z"/><path d="M4 17.5h16"/>',
    heart: '<path d="M20.4 5.6a5 5 0 00-7.1 0L12 6.9l-1.3-1.3a5 5 0 10-7.1 7.1L12 21l8.4-8.3a5 5 0 000-7.1z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 1.9"/>',
    download: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7.5 10.5 12 15l4.5-4.5M12 15V3"/>',
    crown: '<path d="M3 7.5l4 3 5-6.5 5 6.5 4-3-2 11H5L3 7.5z"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-3.6-.7L3 21l1.9-5A8.4 8.4 0 013 11.5 8.5 8.5 0 0112 3a8.5 8.5 0 019 8.5z"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1.5 14h5M9.5 8h5M17.5 16h5"/>',
    shield: '<path d="M12 22s8-3.6 8-10V5.5L12 2 4 5.5V12c0 6.4 8 10 8 10z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
    play: '<path d="M6.5 4.5l12 7.5-12 7.5V4.5z"/>',
    pause: '<path d="M8 4.5h3.2v15H8zM12.8 4.5H16v15h-3.2z"/>',
    shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6M4 4l5 5"/>',
    prev: '<path d="M18 5v14L8 12l10-7z"/><path d="M6 4.5v15"/>',
    next: '<path d="M6 5v14l10-7L6 5z"/><path d="M18 4.5v15"/>',
    repeat: '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 12V9.5a3.5 3.5 0 013.5-3.5h13.5"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12v2.5a3.5 3.5 0 01-3.5 3.5H3.5"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevL: '<path d="M15 18.5 7.5 11 15 3.5"/>',
    chevR: '<path d="M9 5l7.5 7.5L9 20"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    bell: '<path d="M18 8.5a6 6 0 10-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z"/><path d="M13.7 20a2 2 0 01-3.4 0"/>',
    quote: '<path d="M3 21c0-8 4-12 9-12v3c-3 0-5 2-5 5h4v4H3z"/><path d="M13 21c0-8 4-12 9-12v3c-3 0-5 2-5 5h4v4h-8z"/>',
    upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7.5 8 12 3.5l4.5 4.5M12 3.5V15"/>',
    trend: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    wallet: '<path d="M20 7.5V6a2 2 0 00-2-2H5a2 2 0 000 4h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6"/><circle cx="16.5" cy="13.5" r="1.2"/>',
    film: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M7 4.5v15M17 4.5v15M2.5 12h19M2.5 8h4.5M2.5 16h4.5M17 8h4.5M17 16h4.5"/>',
    hourglass: '<path d="M6 3h12M6 21h12"/><path d="M7.5 3v3.5L12 12l4.5-5.5V3"/><path d="M7.5 21v-3.5L12 12l4.5 5.5V21"/>',
    link: '<path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7L13 18"/>',
    radio: '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 000 8.4M16.2 16.2a6 6 0 000-8.4"/><path d="M4.9 4.9a10 10 0 000 14.2M19.1 19.1a10 10 0 000-14.2"/>',
    star: '<path d="m12 2.5 2.9 5.9 6.6 1-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-1L12 2.5z"/>'
  };

  function ic(n, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[n] || '') + '</svg>';
  }
  function icf(n) {
    return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">' + (ICONS[n] || '') + '</svg>';
  }

  /* --- tiny router -------------------------------------------------------- */

  var state = {
    screen: 'discover',
    overlay: null,      // 'lyrics' | 'queue' — slides over whatever screen is showing
    tab: 'home',
    ctx: null,          // screen-specific argument (artiste id, choir name, …)
    authMode: 'signin',
    song: SONGS[2],     // currently loaded track
    playing: true,
    favs: { 'c6f7f48f': 1, 'e86403b9': 1 },
    premium: false,
    payment: 'momo',
    studioTab: 'upload',
    adminTab: 'overview',
    libSeg: 'songs',
    savedPlan: '',
    skipsLeft: 6,
    adFree: false
  };

  function go(screen, ctx) {
    state.screen = screen;
    state.overlay = null;
    if (ctx !== undefined) state.ctx = ctx;
    window.scrollTo(0, 0);
    render();
  }
  function playSong(song) {
    state.song = song;
    state.playing = true;
    state.screen = 'player';
    state.overlay = null;
    render();
  }
  function toggleFav(id) {
    if (state.favs[id]) delete state.favs[id];
    else state.favs[id] = 1;
    render();
  }
  function isFav(id) { return !!state.favs[id]; }

  /* --- helpers ------------------------------------------------------------ */

  function byId(id) {
    for (var i = 0; i < SONGS.length; i++) if (SONGS[i].id === id) return SONGS[i];
    return null;
  }
  function artisteByName(n) {
    for (var i = 0; i < ARTISTES.length; i++) if (ARTISTES[i].name === n) return ARTISTES[i];
    return null;
  }
  function songsByArtist(n) {
    return SONGS.filter(function (s) { return s.artist === n; });
  }
  function fmt(sec) {
    if (!sec) return '0:00';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function initials(n) {
    return String(n || '?').split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }
  function shuffleTake(arr, n) {
    var a = arr.slice(), out = [];
    var seed = 7;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    while (a.length && out.length < n) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]);
    return out;
  }
  function ver() {
    return '<span class="verified" title="Verified artiste">' +
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5l2.6 2.1 3.3-.3.9 3.2 2.8 1.8-1.4 3 1.4 3-2.8 1.8-.9 3.2-3.3-.3L12 22.5l-2.6-2.1-3.3.3-.9-3.2L2.4 15.7l1.4-3-1.4-3 2.8-1.8.9-3.2 3.3.3L12 1.5zm-1 13.9l5.3-5.3-1.4-1.4L11 12.6 9.1 10.7l-1.4 1.4 3.3 3.3z"/></svg>' +
      '</span>';
  }

  /* --- reusable blocks ---------------------------------------------------- */

  /* Header. opts = { back: [screen, ctx?], right: '<html>' } */
  function header(title, sub, opts) {
    opts = opts || {};
    var back = '';
    if (opts.back) {
      back = '<button class="icon-btn" data-go="' + opts.back[0] + '"' +
        (opts.back[1] ? ' data-ctx="' + esc(opts.back[1]) + '"' : '') +
        ' aria-label="Back">' + ic('chevL') + '</button>';
    }
    return '<div class="hdr">' + back +
      '<div><h1 class="hdr__title">' + esc(title) + '</h1>' +
      (sub ? '<p class="hdr__sub">' + esc(sub) + '</p>' : '') + '</div>' +
      '<div class="hdr__spacer"></div>' + (opts.right || '') + '</div>';
  }
  /* Standalone back button, for headers that need a different layout. */
  function backBtn(target, ctx) {
    return '<button class="icon-btn" data-go="' + target + '"' +
      (ctx ? ' data-ctx="' + esc(ctx) + '"' : '') + ' aria-label="Back">' + ic('chevL') + '</button>';
  }
  function searchBar(ph) {
    return '<div class="search" data-go="search">' + ic('search') +
      '<span>' + esc(ph || 'Search songs, artistes, sermons') + '</span></div>';
  }
  function card(song) {
    return '<div class="card" data-play="' + song.id + '">' +
      '<div class="card__art"><img src="' + esc(song.cover) + '" alt="' + esc(song.title) + '"></div>' +
      '<div class="card__name">' + esc(song.title) + '</div>' +
      '<div class="card__meta">' + esc(song.artist) + '</div></div>';
  }
  function scroller(items, label) {
    return '<div class="scroller">' + items.join('') + '</div>';
  }
  function row(song, opts) {
    opts = opts || {};
    var o = '';
    if (opts.rank) o += '<div class="row__rank">' + opts.rank + '</div>';
    o += '<div class="row__art"><img src="' + esc(song.cover) + '" alt=""></div>';
    o += '<div class="row__main"><div class="row__title">' + esc(song.title) + '</div>' +
      '<div class="row__sub">' + esc(song.artist) +
      (song.cat === 'Sermons' ? ' · Sermon' : '') + '</div></div>';
    if (opts.time !== false) {
      o += '<div class="row__time">' + (opts.time || fmt(song.sec)) + '</div>';
    }
    o += '<div class="row__play">' + icf('play') + '</div>';
    var on = ' data-play="' + song.id + '"';
    return '<div class="row' + (state.song && song.id === state.song.id ? ' row--active' : '') + '"' + on + '>' + o + '</div>';
  }
  function songList(songs, opts) {
    return songs.map(function (s, i) {
      return row(s, { rank: opts && opts.rank ? i + 1 : 0 });
    }).join('');
  }
  function empty(icon, t, d) {
    return '<div class="empty">' + ic(icon) + '<div class="empty__t">' + esc(t) + '</div>' +
      '<div class="empty__d">' + esc(d) + '</div></div>';
  }

  /* --- tab bar ------------------------------------------------------------ */

  var TABS = [
    { id: 'home', label: 'Home', icon: 'home', screens: ['discover'] },
    { id: 'trending', label: 'Trending', icon: 'flame', screens: ['trending'] },
    { id: 'library', label: 'Library', icon: 'disc', screens: ['favorites', 'playlists', 'recent', 'offline', 'albums'] },
    { id: 'messages', label: 'Messages', icon: 'chat', screens: ['messages'] },
    { id: 'account', label: 'Account', icon: 'sliders', screens: ['account', 'premium', 'artiste-studio', 'admin', 'settings', 'profile'] }
  ];
  function tabFor(screen) {
    for (var i = 0; i < TABS.length; i++) {
      if (TABS[i].screens.indexOf(screen) > -1) return TABS[i].id;
    }
    return null;
  }

  var NO_CHROME = { player: 1, chat: 1, splash: 1, signin: 1, signup: 1, onboard: 1 };

  function renderChrome() {
    var c = el('chrome');
    if (NO_CHROME[state.screen]) { c.innerHTML = ''; return; }

    var tab = tabFor(state.screen);
    var tabs = TABS.map(function (t) {
      return '<button class="tab' + (t.id === tab ? ' tab--on' : '') + '" data-tab="' + t.id + '">' +
        ic(t.icon) + '<span>' + t.label + '</span></button>';
    }).join('');

    var s = state.song;
    var mini = '<div class="mini" data-go="player">' +
      '<div class="mini__art"><img src="' + esc(s.cover) + '" alt=""></div>' +
      '<div class="mini__main"><div class="mini__title">' + esc(s.title) + '</div>' +
      '<div class="mini__sub">' + esc(s.artist) + '</div>' +
      '<div class="mini__bar"><i></i></div></div>' +
      '<button class="mini__ctl" data-toggle="1">' + icf(state.playing ? 'pause' : 'play') + '</button>' +
      '</div>';

    c.innerHTML = mini + '<div class="tabs">' + tabs + '</div>';
  }

  /* --- screens ------------------------------------------------------------ */

  var SCREENS = {};

  SCREENS.splash = function () {
    return '<div class="screen screen--auth" style="background:radial-gradient(600px 500px at 50% 20%,rgba(26,156,42,.35),transparent 60%),#09090b">' +
      '<div class="auth">' +
      '<div class="auth__logo" style="margin-top:250px">' + ic('music') + '</div>' +
      '<h1 class="auth__h">Gyidi Nnwom</h1>' +
      '<p class="auth__p">SCG Music, Lyrics, Premieres &amp; Sermons</p>' +
      '<button class="btn btn--primary btn--wide" data-go="signin">Get started</button>' +
      '<button class="btn btn--ghost btn--wide" style="margin-top:10px" data-go="discover">Browse as guest</button>' +
      '<p class="auth__legal">' + S.songs + ' songs · ' + S.sermons + ' sermons · ' + S.choirs + ' choirs</p>' +
      '</div></div>';
  };

  SCREENS.signin = function () {
    return '<div class="screen screen--auth"><div class="scroll"><div class="auth">' +
      backBtn('splash') +
      '<div class="auth__logo" style="margin-top:14px">' + ic('music') + '</div>' +
      '<h1 class="auth__h">Welcome back</h1>' +
      '<p class="auth__p">Sign in to sync your favourites, playlists<br>and listening history.</p>' +
      '<div class="field" style="padding-left:0;padding-right:0"><div class="field__l">Email or phone</div>' +
      '<input class="field__i" placeholder="you@example.com" value="kofi@example.com"></div>' +
      '<div class="field" style="padding-left:0;padding-right:0"><div class="field__l">Password</div>' +
      '<input class="field__i" type="password" placeholder="••••••••" value="password"></div>' +
      '<button class="btn btn--primary btn--wide" data-go="onboard">Sign in</button>' +
      '<button class="btn btn--ghost btn--wide" style="margin-top:10px">' +
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44-3.95 0-7.14-3.21-7.14-7s3.19-7 7.14-7c1.89 0 3.63.7 4.95 1.86l1.93-1.93A9.99 9.99 0 003.1 11a9.9 9.9 0 009.9 9.9c5.62 0 9.35-3.96 9.35-9.53 0-.63-.06-1.26-.19-1.86z"/></svg>' +
      'Continue with Google</button>' +
      '<div class="auth__switch">New here? <b data-go="signup">Create an account</b></div>' +
      '<p class="auth__legal">By continuing you agree to our Terms &amp; Privacy Policy</p>' +
      '</div></div></div>';
  };

  SCREENS.signup = function () {
    return '<div class="screen screen--auth"><div class="scroll"><div class="auth">' +
      backBtn('signin') +
      '<h1 class="auth__h" style="margin-top:40px">Create account</h1>' +
      '<p class="auth__p">Free forever. No card needed.</p>' +
      '<div class="field" style="padding-left:0;padding-right:0"><div class="field__l">Full name</div>' +
      '<input class="field__i" placeholder="Your name"></div>' +
      '<div class="field" style="padding-left:0;padding-right:0"><div class="field__l">Email</div>' +
      '<input class="field__i" placeholder="you@example.com"></div>' +
      '<div class="field" style="padding-left:0;padding-right:0"><div class="field__l">Church zone / branch</div>' +
      '<input class="field__i" placeholder="e.g. Ashanti Zone, Kumawu"></div>' +
      '<button class="btn btn--primary btn--wide" data-go="onboard">Create account</button>' +
      '<div class="auth__switch">Already have one? <b data-go="signin">Sign in</b></div>' +
      '<div class="notice notice--gold" style="margin:18px 0 0"><b>Artiste?</b> You can apply for a verified Artiste Studio account after signup.</div>' +
      '</div></div></div>';
  };

  SCREENS.onboard = function () {
    var chips = ['Obogu Seth', 'Yaw Baidoo', 'Kumawu Choir', 'Mponua Choir', 'Op. Abraham', 'Greater Accra Boysco_KOJO', 'Bosiako', 'SACSU Fellowship'];
    return '<div class="screen screen--auth"><div class="scroll"><div class="auth">' +
      '<h1 class="auth__h" style="margin-top:36px">Pick your favourites</h1>' +
      '<p class="auth__p">Follow a few ministries to build your Home feed.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">' +
      chips.map(function (c, i) {
        return '<span class="chip' + (i < 3 ? ' chip--on' : '') + '">' + esc(c) + '</span>';
      }).join('') + '</div>' +
      '<button class="btn btn--primary btn--wide" data-go="discover">Continue — 3 selected</button>' +
      '<button class="btn btn--ghost btn--wide" style="margin-top:10px" data-go="discover">Skip for now</button>' +
      '</div></div></div>';
  };

  SCREENS.discover = function () {
    var newSongs = SONGS.filter(function (s) { return s.cat === 'Songs'; }).slice(0, 8);
    var sermons = SONGS.filter(function (s) { return s.cat === 'Sermons'; });
    var choirs = ARTISTES.filter(function (a) { return a.tier === 'artiste'; }).slice(0, 8);

    return '<div class="screen"><div class="scroll">' +
      header('Discover', S.songs + ' songs · ' + S.choirs + ' choirs',
        '<button class="icon-btn" data-go="messages">' + ic('bell') + '<i class="dot"></i></button>') +
      searchBar() +

      '<div class="hub">' + [
        ['sparkles', 'New', 'new'], ['flame', 'Trending', 'trending'],
        ['star', 'Premieres', 'premieres'], ['calendar', 'Upcoming', 'upcoming'],
        ['live', 'Live', 'live'], ['disc', 'Albums', 'albums'],
        ['mic', 'Artistes', 'artistes'], ['grid', 'Browse', 'browse'],
        ['users', 'Choirs', 'choirs'], ['book', 'Sermons', 'sermons']
      ].map(function (h) {
        return '<button class="hub__i" data-go="' + h[2] + '">' + ic(h[0]) +
          '<span>' + h[1] + '</span></button>';
      }).join('') + '</div>' +

      '<div class="hero">' +
      '<div class="hero__kicker">Premiere · Saturday 09:00</div>' +
      '<h2 class="hero__title">Ayeyi Bɛn<br>by Obogu Seth</h2>' +
      '<p class="hero__desc">Be first in line. Set a reminder and the track unlocks the moment it drops.</p>' +
      '<div class="hero__row">' +
      '<button class="btn btn--primary" data-go="premieres">' + ic('bell') + 'Remind me</button>' +
      '<button class="btn btn--glass" data-go="artiste" data-ctx="Obogu Seth">View artiste</button>' +
      '</div></div>' +

      '<div class="sect"><div class="sect__head"><h2 class="sect__title">New this week</h2>' +
      '<span class="sect__more" data-go="new">See all</span></div>' +
      scroller(newSongs.slice(0, 6).map(card)) + '</div>' +

      '<div class="sect"><div class="sect__head"><h2 class="sect__title">Trending now</h2>' +
      '<span class="sect__more" data-go="trending">See all</span></div>' +
      scroller(shuffleTake(newSongs, 6).map(card)) + '</div>' +

      '<div class="sect"><div class="sect__head"><h2 class="sect__title">Sermons &amp; teachings</h2>' +
      '<span class="sect__more" data-go="sermons">See all</span></div>' +
      scroller(sermons.concat(newSongs.slice(8, 10)).map(card)) + '</div>' +

      '<div class="sect"><div class="sect__head"><h2 class="sect__title">Choirs &amp; ministries</h2>' +
      '<span class="sect__more" data-go="choirs">See all</span></div>' +
      scroller(choirs.map(function (a) {
        return '<div class="card" data-go="artiste" data-ctx="' + esc(a.name) + '">' +
          '<div class="card__art"><img src="' + (a.avatar || D.coverFor(a.name)) + '" alt=""></div>' +
          '<div class="card__name">' + esc(a.name) + (a.verified ? ' ' + ver() : '') + '</div>' +
          '<div class="card__meta">' + esc(a.zone) + '</div></div>';
      })) + '</div>' +

      '<div class="sect"><div class="sect__head"><h2 class="sect__title">Made for you</h2></div>' +
      songList(shuffleTake(newSongs, 5)) + '</div>' +

      '</div></div>';
  };

  SCREENS.new = function () {
    var list = SONGS.filter(function (s) { return s.cat === 'Songs'; }).slice(8, 24);
    return '<div class="screen"><div class="scroll">' +
      header('New Music', 'Freshly uploaded', { back: ['discover'] }) +
      searchBar() + '<div class="sect">' + songList(list) + '</div></div></div>';
  };

  SCREENS.trending = function () {
    var top = SONGS.filter(function (s) { return s.cat === 'Songs'; }).slice(0, 10);
    return '<div class="screen"><div class="scroll">' +
      header('Trending', 'Most played this week') +
      '<div class="chips">' +
      '<span class="chip chip--on">This week</span><span class="chip">This month</span>' +
      '<span class="chip">Ashanti Zone</span><span class="chip">Greater Accra</span>' +
      '<span class="chip">Okyeman Zone</span></div>' +
      '<div class="sect">' + songList(top, { rank: true }) + '</div>' +
      '</div></div>';
  };

  SCREENS.premieres = function () {
    return '<div class="screen"><div class="scroll">' +
      header('Premieres', 'Countdown drops', { back: ['discover'] }) +
      D.PREMIERES.map(function (p) {
        return '<div style="margin:6px 18px 12px;padding:16px;border-radius:16px;border:1px solid var(--line);background:linear-gradient(150deg,rgba(255,183,0,.1),rgba(255,183,0,.02))">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
          '<span class="pill pill--pending">In ' + p.days + ' days</span>' +
          '<span style="font-size:11px;color:var(--text-3)">' + esc(p.at) + '</span></div>' +
          '<div style="font-family:var(--font-display);font-size:17px;font-weight:800;margin:8px 0 3px">' + esc(p.title) + '</div>' +
          '<div style="font-size:12px;color:var(--text-2)">' + esc(p.artist) + '</div>' +
          '<div style="display:flex;gap:8px;margin-top:12px">' +
          '<button class="btn btn--primary" style="height:38px;font-size:12px">' + ic('bell') + 'Remind me</button>' +
          '<button class="btn btn--ghost" style="height:38px;font-size:12px" data-go="artiste" data-ctx="' + esc(p.artist) + '">Artiste</button>' +
          '</div></div>';
      }).join('') +
      '<div class="notice"><b>How premieres work.</b> A premiere is a timed release: the page is live, the audio is not. Fans tap Remind me and get a push notification the second it unlocks.</div>' +
      '</div></div>';
  };

  SCREENS.upcoming = function () {
    return '<div class="screen"><div class="scroll">' +
      header('Upcoming', 'Scheduled releases') +
      '<div class="chips"><span class="chip chip--on">All</span><span class="chip">Songs</span><span class="chip">Sermons</span><span class="chip">Albums</span></div>' +
      D.PREMIERES.concat([{ title: 'Convention 2026 Live', artist: 'National SACSU', at: 'Sat 09:00', days: 2 },
      { title: 'Aseda Nnwom', artist: 'Blacko', at: 'Wed 18:00', days: 6 }]).map(function (p) {
        return '<div class="row" data-go="premieres"><div class="row__art">' +
          '<img src="' + esc(D.coverFor(p.title)) + '" alt=""></div>' +
          '<div class="row__main"><div class="row__title">' + esc(p.title) + '</div>' +
          '<div class="row__sub">' + esc(p.artist) + ' · ' + esc(p.at) + '</div></div>' +
          '<span class="pill pill--pending">In ' + p.days + 'd</span></div>';
      }).join('') +
      '<div class="notice notice--gold"><b>Premium feature.</b> Upcoming + Premieres is where superfans live. Free users see the countdown; premium users get reminder pushes and early access.</div>' +
      '</div></div>';
  };

  SCREENS.live = function () {
    return '<div class="screen"><div class="scroll">' +
      header('Live', 'Streaming now') +
      '<div style="margin:6px 18px 14px;padding:0;border-radius:18px;overflow:hidden;border:1px solid var(--line);background:#000">' +
      '<div style="position:relative;aspect-ratio:16/9;background:radial-gradient(400px 240px at 50% 40%,rgba(26,156,42,.5),transparent 65%),#0a0a0a;display:grid;place-items:center">' +
      '<div style="width:62px;height:62px;border-radius:50%;background:rgba(255,255,255,.14);display:grid;place-items:center;backdrop-filter:blur(6px)">' +
      '<span style="font-size:22px;color:#fff">' + icf('play') + '</span></div>' +
      '<span class="pill pill--live" style="position:absolute;top:12px;left:12px">● Live</span>' +
      '<span style="position:absolute;bottom:12px;right:12px;font-size:11px;color:#fff;background:rgba(0,0,0,.6);padding:3px 7px;border-radius:6px">' + S.listeningNow + ' watching</span>' +
      '</div>' +
      '<div style="padding:14px">' +
      '<div style="font-family:var(--font-display);font-size:16px;font-weight:800">Sunday Service — Osiem Headquarters</div>' +
      '<div style="font-size:12px;color:var(--text-2);margin-top:4px">Op. Abraham · Okyeman Zone</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
      '<button class="btn btn--primary" style="height:38px;font-size:12px;flex:1">Join stream</button>' +
      '<button class="btn btn--ghost" style="height:38px;font-size:12px">' + ic('heart') + '</button>' +
      '</div></div></div>' +
      '<div class="sect"><div class="sect__head"><h2 class="sect__title">Replays</h2></div>' +
      songList(SONGS.filter(function (s) { return s.cat === 'Sermons'; }).concat(SONGS.slice(0, 2))) + '</div>' +
      '</div></div>';
  };

  SCREENS.albums = function () {
    return '<div class="screen"><div class="scroll">' +
      header('Albums', 'Full projects') +
      empty('disc', 'No albums yet',
        'The catalogue is currently single-led — ' + S.songs + ' individual tracks across ' + S.choirs +
        ' choirs. Albums ship in the next release, and the schema already supports them.')
      + '</div></div>';
  };

  SCREENS.artistes = function () {
    return '<div class="screen"><div class="scroll">' +
      header('Artistes', S.artistes + ' verified ministries') +
      searchBar('Search artistes') +
      ARTISTES.filter(function (a) { return a.tier === 'artiste'; }).map(function (a) {
        return '<div class="row" data-go="artiste" data-ctx="' + esc(a.name) + '">' +
          '<div class="row__art" style="border-radius:50%"><img src="' + (a.avatar || D.coverFor(a.name)) + '" alt=""></div>' +
          '<div class="row__main"><div class="row__title">' + esc(a.name) +
          (a.verified ? ' ' + ver() : '') + '</div>' +
          '<div class="row__sub">' + esc(a.zone) + ' · ' + esc(a.branch) + '</div></div>' +
          ic('chevR') + '</div>';
      }).join('') +
      '</div></div>';
  };

  SCREENS.browse = function () {
    var cats = [
      { t: 'Praise & Worship', n: 96, c: 'forest' }, { t: 'Sermons', n: S.sermons, c: 'cyan' },
      { t: 'Choir Ministrations', n: 74, c: 'gold' }, { t: 'Convention Recordings', n: 38, c: 'pink' },
      { t: 'Twi', n: 142, c: 'forest' }, { t: 'English', n: 61, c: 'gold' }
    ];
    return '<div class="screen"><div class="scroll">' +
      header('Browse', 'By category') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:4px 18px 12px">' +
      cats.map(function (c) {
        return '<div class="tile tile--' + c.c + '" style="width:auto" data-go="trending">' +
          '<div class="tile__title">' + esc(c.t) + '</div>' +
          '<div class="tile__desc">' + c.n + ' tracks</div></div>';
      }).join('') + '</div>' +
      '<div class="sect"><div class="sect__head"><h2 class="sect__title">By zone</h2></div>' +
      ['Ashanti Zone', 'Greater Accra Zone', 'Okyeman Zone', 'Sekyere Zone', 'Obogu Zone', 'Kumawu Zone', 'Mponua Zone', 'National SACSU'].map(function (z) {
        return '<div class="row" data-go="choirs"><div class="row__main">' +
          '<div class="row__title">' + esc(z) + '</div></div>' + ic('chevR') + '</div>';
      }).join('') + '</div>' +
      '</div></div>';
  };

  SCREENS.choirs = function () {
    var groups = shuffleTake(SONGS, 10);
    return '<div class="screen"><div class="scroll">' +
      header('Choirs', S.choirs + ' choir groups') +
      searchBar('Search choirs') +
      '<div class="sect">' +
      groups.map(function (s, i) {
        var n = SONGS.filter(function (x) { return x.choir === s.choir; }).length;
        return '<div class="row" data-go="artiste" data-ctx="' + esc(s.artist) + '">' +
          '<div class="row__art"><img src="' + esc(s.cover) + '" alt=""></div>' +
          '<div class="row__main"><div class="row__title">' + esc(s.choir) + '</div>' +
          '<div class="row__sub">' + n + ' recording' + (n === 1 ? '' : 's') + ' · ' + esc(s.artist) + '</div></div>' +
          ic('chevR') + '</div>';
      }).join('') + '</div></div></div>';
  };

  SCREENS.sermons = function () {
    var list = SONGS.filter(function (s) { return s.cat === 'Sermons'; });
    return '<div class="screen"><div class="scroll">' +
      header('Sermons', S.sermons + ' teachings') +
      '<div class="chips"><span class="chip chip--on">All</span><span class="chip">Sunday Service</span>' +
      '<span class="chip">Bible Study</span><span class="chip">Convention</span><span class="chip">Revival</span></div>' +
      '<div class="sect">' + songList(list) + '</div>' +
      '<div class="notice"><b>Sermons are long-form.</b> Average length is about 45 minutes, so the player supports 15-second skip-back, background audio and offline download — the three things listeners actually use here.</div>' +
      '</div></div>';
  };

  SCREENS.favorites = SCREENS.playlists = SCREENS.recent = SCREENS.offline = function () {
    var seg = [['favorites', 'Favourites'], ['playlists', 'Playlists'], ['recent', 'Recent'], ['offline', 'Downloads']];
    var body = '';

    if (state.screen === 'favorites') {
      var f = SONGS.filter(function (s) { return isFav(s.id); });
      body = f.length ? songList(f) : empty('heart', 'No favourites yet', 'Tap the heart on any track and it lands here. Favourites sync across your devices.');
    } else if (state.screen === 'playlists') {
      body = [{ n: 'Sunday Morning', c: 14 }, { n: 'Choir Ministrations', c: 22 }, { n: 'Twi Classics', c: 31 }].map(function (p) {
        return '<div class="row" data-go="trending"><div class="row__art" style="display:grid;place-items:center;background:linear-gradient(140deg,var(--forest-700),var(--forest-900))">' +
          ic('list') + '</div><div class="row__main"><div class="row__title">' + esc(p.n) + '</div>' +
          '<div class="row__sub">' + p.c + ' songs</div></div>' + ic('chevR') + '</div>';
      }).join('') +
        '<div style="padding:14px 18px"><button class="btn btn--ghost btn--wide">' + ic('plus') + 'New playlist</button></div>' +
        '<div class="notice">Playlists are collaborative in the next release — a choir can maintain one shared set for Sunday service.</div>';
    } else if (state.screen === 'recent') {
      body = songList(SONGS.slice(3, 12));
    } else {
      body = empty('download', 'Nothing downloaded', 'Premium subscribers can save any track for offline listening — ideal for areas with poor data coverage.') +
        '<div style="padding:0 18px 18px"><button class="btn btn--primary btn--wide" data-go="premium">Go Premium to download</button></div>';
    }

    return '<div class="screen"><div class="scroll">' +
      header('Your Library', '') +
      '<div class="seg">' + seg.map(function (s) {
        return '<button class="' + (s[0] === state.screen ? 'on' : '') + '" data-seg="' + s[0] + '">' + s[1] + '</button>';
      }).join('') + '</div>' + body + '</div></div>';
  };

  SCREENS.search = function () {
    var results = SONGS.slice(0, 8);
    return '<div class="screen"><div class="scroll">' +
      '<div class="hdr"><div class="search" style="margin:0;flex:1">' + ic('search') +
      '<span style="color:var(--text)">Obogu</span></div>' +
      '<button class="icon-btn" data-go="discover">' + ic('x') + '</button></div>' +
      '<div class="chips"><span class="chip chip--on">All</span><span class="chip">Songs</span>' +
      '<span class="chip">Artistes</span><span class="chip">Sermons</span><span class="chip">Choirs</span></div>' +
      '<div class="sect"><div class="sect__head"><h2 class="sect__title">Top result</h2></div>' +
      '<div style="margin:0 18px 14px;padding:14px;border-radius:16px;background:var(--surface);border:1px solid var(--line);display:flex;gap:12px;align-items:center" data-go="artiste" data-ctx="Obogu Seth">' +
      '<div class="avatar" style="width:56px;height:56px;font-size:18px">' +
      '<img src="https://neicfighjkzokoxojboz.supabase.co/storage/v1/object/public/covers/avatars/artiste-1794209958902.jpeg" alt=""></div>' +
      '<div><div style="font-family:var(--font-display);font-size:16px;font-weight:800">Obogu Seth ' + ver() + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-3);margin-top:2px">Artiste · Obogu Zone</div></div></div>' +
      '<div class="sect__head"><h2 class="sect__title">Songs</h2></div>' +
      songList(results) + '</div>' +
      '<div class="sect"><div class="sect__head"><h2 class="sect__title">Browse categories</h2></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 18px">' +
      ['Praise', 'Sermons', 'Choirs', 'Convention'].map(function (c, i) {
        return '<div class="tile tile--' + ['forest', 'cyan', 'gold', 'pink'][i] + '" style="width:auto" data-go="browse">' +
          '<div class="tile__title">' + c + '</div></div>';
      }).join('') + '</div></div>' +
      '</div></div>';
  };

  SCREENS.artiste = function () {
    var name = state.ctx || 'Obogu Seth';
    var a = artisteByName(name) || ARTISTES[0];
    var tracks = songsByArtist(name);
    if (!tracks.length) tracks = SONGS.slice(0, 5);

    return '<div class="screen"><div class="scroll">' +
      '<div class="hdr" style="padding-top:2px">' + backBtn('artistes') +
      '<div class="hdr__spacer"></div>' +
      '<button class="icon-btn">' + ic('heart') + '</button>' +
      '<button class="icon-btn">' + ic('list') + '</button></div>' +

      '<div style="padding:6px 18px 0;display:flex;flex-direction:column;align-items:center;text-align:center">' +
      '<div class="avatar" style="width:104px;height:104px">' +
      (a.avatar ? '<img src="' + esc(a.avatar) + '" alt="">' : initials(a.name)) + '</div>' +
      '<h1 style="font-family:var(--font-display);font-size:21px;font-weight:800;margin:14px 0 4px;display:flex;align-items:center;gap:6px">' +
      esc(a.name) + (a.verified ? ver() : '') + '</h1>' +
      '<p style="font-size:12px;color:var(--text-3);margin:0">' + esc(a.zone) + ' · ' + esc(a.branch) + '</p>' +
      '<div style="display:flex;gap:8px;margin:14px 0 2px">' +
      '<button class="btn btn--primary" style="height:38px;font-size:12.5px" data-play="' + tracks[0].id + '">' + icf('play') + 'Play</button>' +
      '<button class="btn btn--ghost" style="height:38px;font-size:12.5px">Follow</button>' +
      '</div></div>' +

      '<div class="stats" style="padding-top:16px">' +
      '<div class="stat stat--forest"><div class="stat__n">' + tracks.length + '</div><div class="stat__l">Tracks</div></div>' +
      '<div class="stat stat--gold"><div class="stat__n">' + (tracks.length * 37 + 12) + '</div><div class="stat__l">Plays this month</div></div>' +
      '</div>' +

      '<div class="sect"><div class="sect__head"><h2 class="sect__title">Popular</h2></div>' +
      songList(tracks.slice(0, 6), { rank: true }) + '</div>' +

      '<div style="padding:6px 18px 0"><div class="notice">Artiste pages are auto-generated from uploads — every artiste with a Studio account gets one, verified with the blue tick once an admin approves them.</div></div>' +
      '</div></div>';
  };

  SCREENS.messages = function () {
    var unread = D.MESSAGES.filter(function (m) { return m.unread; }).length;
    return '<div class="screen"><div class="scroll">' +
      header('Messages', unread + ' unread') +
      '<div class="chips"><span class="chip chip--on">All</span><span class="chip">Broadcasts</span><span class="chip">Artistes</span><span class="chip">Support</span></div>' +
      D.MESSAGES.map(function (m) {
        return '<div class="msg' + (m.unread ? ' msg--unread' : '') + '" data-go="chat" data-ctx="' + esc(m.from) + '">' +
          '<div class="msg__av">' + (m.broadcast ? ic('radio') : initials(m.from)) + '</div>' +
          '<div class="msg__main"><div class="msg__top"><span class="msg__name">' + esc(m.from) + '</span>' +
          (m.broadcast ? '<span class="pill pill--broadcast">Broadcast</span>' : '') +
          '<span class="msg__time">' + esc(m.time) + '</span></div>' +
          '<div class="msg__body">' + esc(m.body) + '</div></div></div>';
      }).join('') +
      '<div class="notice">Messages is an ad-free zone — the AdSense policy fix means banners never render on private or broadcast threads.</div>' +
      '</div></div>';
  };

  SCREENS.chat = function () {
    var who = state.ctx || 'Gyidi Nnwom';
    return '<div class="screen"><div class="scroll" style="padding-bottom:104px">' +
      '<div class="hdr" style="padding-top:2px">' + backBtn('messages') +
      '<div style="flex:1"><div style="font-family:var(--font-display);font-size:16px;font-weight:800">' + esc(who) + '</div>' +
      '<div style="font-size:11px;color:var(--text-3)">' + (who === 'Gyidi Nnwom' ? 'Official announcements' : 'Artiste') + '</div></div>' +
      '<button class="icon-btn">' + ic('list') + '</button></div>' +

      '<div style="padding:10px 18px">' +
      '<div style="align-self:flex-start;max-width:78%;padding:11px 14px;border-radius:16px 16px 16px 4px;background:var(--surface-2);border:1px solid var(--line)">' +
      '<div style="font-size:13px;line-height:1.5">' + esc(D.MESSAGES[0].body) + '</div>' +
      '<div style="font-size:10px;color:var(--text-3);margin-top:5px">' + esc(D.MESSAGES[0].time) + ' ago</div>' +
      '</div></div>' +
      '<div style="padding:0 18px 8px;display:flex;justify-content:flex-end">' +
      '<div style="max-width:78%;padding:11px 14px;border-radius:16px 16px 4px 16px;background:var(--forest-600)">' +
      '<div style="font-size:13px;line-height:1.5">Received, thank you! Will listen this evening.</div>' +
      '<div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:5px">Just now · Read</div>' +
      '</div></div>' +
      '<div style="padding:4px 18px">' +
      '<div style="align-self:flex-start;max-width:78%;padding:11px 14px;border-radius:16px 16px 16px 4px;background:var(--surface-2);border:1px solid var(--line)">' +
      '<div style="font-size:13px;line-height:1.5">Typing…</div></div></div>' +
      '</div>' +

      '<div style="position:absolute;left:0;right:0;bottom:0;z-index:40;display:flex;gap:8px;padding:12px 18px 30px;background:rgba(9,9,11,.96);border-top:1px solid var(--line)">' +
      '<div style="flex:1;height:40px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid var(--line);display:flex;align-items:center;padding:0 14px;font-size:13px;color:var(--text-3)">Message</div>' +
      '<button class="btn btn--primary" style="width:40px;height:40px;padding:0;border-radius:50%">' + ic('plus') + '</button>' +
      '</div></div>';
  };

  SCREENS.premium = function () {
    var perks = [
      ['Ad-free listening', 'No banner or audio ads anywhere in the app.'],
      ['Offline downloads', 'Save sermons and songs for areas with weak data.'],
      ['Unlimited skips', 'Free accounts get 6 skips an hour.'],
      ['Premieres & early access', 'Hear new releases before everyone else.'],
      ['Lossless audio', 'Higher bitrate streaming where bandwidth allows.']
    ];
    var plans = [
      { id: 'momo', n: 'Mobile Money', p: 'GH₵ 15', d: 'MTN · Vodafone · AirtelTigo — billed monthly' },
      { id: 'card', n: 'Card', p: 'GH₵ 15', d: 'Visa · Mastercard — billed monthly' },
      { id: 'year', n: 'Annual', p: 'GH₵ 150', d: 'Two months free · billed once a year' }
    ];
    return '<div class="screen"><div class="scroll">' +
      header('Premium', 'Support the ministry', { back: ['account'] }) +

      '<div style="margin:6px 18px 14px;padding:22px 18px;border-radius:20px;text-align:center;background:radial-gradient(400px 240px at 50% 0%,rgba(255,183,0,.28),transparent 62%),linear-gradient(150deg,var(--forest-800),#09090b)">' +
      '<div style="width:52px;height:52px;border-radius:50%;background:var(--gold-400);display:grid;place-items:center;margin:0 auto;color:#1a1200">' + ic('crown') + '</div>' +
      '<h2 style="font-family:var(--font-display);font-size:20px;font-weight:800;margin:12px 0 4px">Gyidi Nnwom Premium</h2>' +
      '<p style="font-size:12px;color:var(--text-2);margin:0;line-height:1.5">Remove ads, download for offline, and unlock premieres.</p>' +
      '</div>' +

      perks.map(function (p) {
        return '<div class="perk">' + ic('check') + '<div><div class="perk__t">' + esc(p[0]) + '</div>' +
          '<div class="perk__d">' + esc(p[1]) + '</div></div></div>';
      }).join('') +

      '<div class="sect__head" style="padding-top:18px"><h2 class="sect__title">Choose a plan</h2></div>' +
      plans.map(function (p) {
        return '<div class="pay' + (state.payment === p.id ? ' pay--on' : '') + '" data-pay="' + p.id + '">' +
          '<div class="pay__top"><span class="pay__name">' + esc(p.n) + '</span>' +
          '<span class="pay__price">' + esc(p.p) + '</span></div>' +
          '<p class="pay__desc">' + esc(p.d) + '</p></div>';
      }).join('') +

      '<div style="padding:4px 18px 0">' +
      '<button class="btn btn--primary btn--wide" data-act="subscribe">' + ic('crown') +
      (state.premium ? 'You are Premium — cancel anytime' : 'Start Premium') + '</button>' +
      '<p style="font-size:10.5px;color:var(--text-3);text-align:center;line-height:1.5;margin-top:12px">' +
      'Payments by Paystack. Cancel anytime from Account → Billing.</p></div>' +
      '</div></div>';
  };

  SCREENS.account = function () {
    var me = ARTISTES[ARTISTES.length - 1];
    var menu = [
      ['crown', 'Premium', state.premium ? 'Active' : 'Ad-free · downloads', 'premium'],
      ['mic', 'Artiste Studio', 'Upload & manage releases', 'artiste-studio'],
      ['shield', 'Admin', 'Approvals · analytics', 'admin'],
      ['heart', 'Favourites', Object.keys(state.favs).length + ' songs', 'favorites'],
      ['download', 'Downloads', 'Offline library', 'offline'],
      ['wallet', 'Billing', 'Manage subscription', 'premium'],
      ['sliders', 'Settings', 'Notifications · audio quality', 'settings']
    ];
    return '<div class="screen"><div class="scroll">' +
      header('Account', '', { right: '<button class="icon-btn" data-go="settings">' + ic('sliders') + '</button>' }) +
      '<div class="profile">' +
      '<div class="avatar">' + (me.avatar ? '<img src="' + esc(me.avatar) + '" alt="">' : initials(me.name)) + '</div>' +
      '<div><h2 class="profile__name">' + esc(me.name) + ver() + '</h2>' +
      '<p class="profile__meta">' + esc(me.zone) + ' · ' + esc(me.branch) + '</p>' +
      '<span class="pill pill--forest" style="margin-top:6px">Admin</span></div></div>' +

      '<div class="stats">' +
      '<div class="stat stat--gold"><div class="stat__n">' + S.plays + '</div><div class="stat__l">Total plays</div></div>' +
      '<div class="stat stat--forest"><div class="stat__n">' + Object.keys(state.favs).length + '</div><div class="stat__l">Favourites</div></div>' +
      '</div>' +

      menu.map(function (m) {
        return '<div class="row" data-go="' + m[3] + '">' +
          '<div class="row__art" style="display:grid;place-items:center;background:var(--surface-2);color:var(--text-2)">' + ic(m[0]) + '</div>' +
          '<div class="row__main"><div class="row__title">' + esc(m[1]) + '</div>' +
          '<div class="row__sub">' + esc(m[2]) + '</div></div>' + ic('chevR') + '</div>';
      }).join('') +

      '<div style="padding:18px"><button class="btn btn--ghost btn--wide" data-go="splash">Sign out</button></div>' +
      '</div></div>';
  };

  SCREENS.settings = function () {
    var rows = [
      ['Audio quality', 'Auto (saves data)'],
      ['Download over Wi-Fi only', 'On'],
      ['Push notifications', 'Premieres & new uploads'],
      ['Crossfade', '6 seconds'],
      ['Language', 'English'],
      ['Data saver', 'Off']
    ];
    return '<div class="screen"><div class="scroll">' +
      header('Settings', '', { back: ['account'] }) +
      rows.map(function (r) {
        return '<div class="row"><div class="row__main"><div class="row__title">' + esc(r[0]) + '</div>' +
          '<div class="row__sub">' + esc(r[1]) + '</div></div>' + ic('chevR') + '</div>';
      }).join('') +
      '<div class="sect__head"><h2 class="sect__title">About</h2></div>' +
      '<div style="padding:0 18px;font-size:11.5px;color:var(--text-3);line-height:1.6">' +
      'Gyidi Nnwom · Version 1.0.0<br>' + S.songs + ' songs · ' + S.sermons + ' sermons · ' + S.choirs + ' choirs<br>' +
      'Terms · Privacy · Delete account</div>' +
      '</div></div>';
  };

  /* --- Artiste Studio ------------------------------------------------------ */

  SCREENS['artiste-studio'] = function () {
    var seg = [['upload', 'Upload'], ['releases', 'My Releases'], ['stats', 'Stats'], ['payouts', 'Earnings']];
    var body = '';

    if (state.studioTab === 'upload') {
      body =
        '<div class="drop" data-go="upload">' + ic('upload') +
        '<div class="drop__t">Drop an audio file</div>' +
        '<div class="drop__d">MP3, M4A or WAV · up to 200 MB</div></div>' +
        '<div class="field"><div class="field__l">Title</div><input class="field__i" placeholder="e.g. Ayeyi Bɛn"></div>' +
        '<div class="field"><div class="field__l">Category</div><input class="field__i" value="Songs"></div>' +
        '<div class="field"><div class="field__l">Language</div><input class="field__i" placeholder="Twi / English / Ga"></div>' +
        '<div class="field"><div class="field__l">Choir group</div><input class="field__i" placeholder="e.g. Obogu Choir"></div>' +
        '<div class="field"><div class="field__l">Lyrics (optional)</div>' +
        '<div class="field__i" style="height:auto;padding:11px 13px;line-height:1.5;color:var(--text-3);min-height:80px">' +
        'Paste lyrics to unlock the synced lyrics view…</div></div>' +
        '<div style="display:flex;gap:8px;padding:4px 18px 0">' +
        '<button class="btn btn--forest" style="flex:1" data-go="upload">' + ic('upload') + 'Submit for review</button>' +
        '</div>' +
        '<div class="notice notice--gold" style="margin-top:16px"><b>Goes to an admin first.</b> Every upload is queued for approval — it stays invisible to listeners until an admin passes it.</div>';
    } else if (state.studioTab === 'releases') {
      body = SONGS.slice(0, 8).map(function (s, i) {
        var st = i < 2 ? ['pill--pending', 'In review'] : (i === 2 ? ['pill--live', 'Rejected'] : ['pill--forest', 'Live']);
        return '<div class="row"><div class="row__art"><img src="' + esc(s.cover) + '" alt=""></div>' +
          '<div class="row__main"><div class="row__title">' + esc(s.title) + '</div>' +
          '<div class="row__sub">' + esc(s.artist) + ' · <span class="pill ' + st[0] + '">' + st[1] + '</span></div></div>' +
          ic('list') + '</div>';
      }).join('') +
        '<div style="padding:14px 18px"><button class="btn btn--ghost btn--wide" data-go="upload">' + ic('plus') + 'New release</button></div>';
    } else if (state.studioTab === 'stats') {
      body = '<div class="stats">' +
        '<div class="stat stat--forest"><div class="stat__n">1,284</div><div class="stat__l">Total plays</div></div>' +
        '<div class="stat stat--gold"><div class="stat__n">312</div><div class="stat__l">This month</div></div>' +
        '<div class="stat"><div class="stat__n">48</div><div class="stat__l">Followers</div></div>' +
        '<div class="stat"><div class="stat__n">6</div><div class="stat__l">Downloads</div></div>' +
        '</div>' +
        '<div class="sect__head"><h2 class="sect__title">Last 7 days</h2></div>' +
        '<div class="bars-mini">' + [38, 52, 30, 66, 44, 78, 58].map(function (h) {
          return '<div style="height:' + h + '%"></div>';
        }).join('') + '</div>' +
        '<div style="display:flex;justify-content:space-between;padding:0 18px;font-size:10px;color:var(--text-3)">' +
        '<span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>' +
        '<div class="sect"><div class="sect__head"><h2 class="sect__title">Top tracks</h2></div>' +
        songList(SONGS.slice(0, 4), { rank: true }) + '</div>';
    } else {
      body = '<div class="stats">' +
        '<div class="stat stat--gold"><div class="stat__n">GH₵ 420</div><div class="stat__l">This month</div></div>' +
        '<div class="stat stat--forest"><div class="stat__n">GH₵ 1,860</div><div class="stat__l">All time</div></div>' +
        '</div>' +
        '<div class="sect__head"><h2 class="sect__title">Payout history</h2></div>' +
        [['October 2026', 'GH₵ 512', 'Paid'], ['September 2026', 'GH₵ 438', 'Paid'], ['August 2026', 'GH₵ 390', 'Paid']].map(function (p) {
          return '<div class="row"><div class="row__main"><div class="row__title">' + esc(p[0]) + '</div>' +
            '<div class="row__sub">' + esc(p[2]) + ' · Paystack transfer</div></div>' +
            '<div style="font-family:var(--font-display);font-size:14px;font-weight:800">' + esc(p[1]) + '</div></div>';
        }).join('') +
        '<div class="notice">Artiste payouts are handled per-release through the Content Monetization panel in Admin. Rates are set per artiste or per release.</div>';
    }

    return '<div class="screen"><div class="scroll">' +
      header('Artiste Studio', 'Obogu Seth', { back: ['account'] }) +
      '<div class="seg">' + seg.map(function (s) {
        return '<button class="' + (s[0] === state.studioTab ? 'on' : '') + '" data-studio="' + s[0] + '">' + s[1] + '</button>';
      }).join('') + '</div>' + body + '</div></div>';
  };

  SCREENS.upload = function () {
    return '<div class="screen"><div class="scroll">' +
      header('New Release', 'Step 3 of 3', { back: ['artiste-studio'] }) +
      '<div style="margin:10px 18px 14px;padding:18px;border-radius:16px;background:var(--surface);border:1px solid var(--line)">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      '<div style="width:52px;height:52px;border-radius:12px;overflow:hidden"><img src="' + esc(SONGS[0].cover) + '" alt="" style="width:100%;height:100%;object-fit:cover"></div>' +
      '<div><div style="font-size:13.5px;font-weight:600">ayeyi-ben.mp3</div>' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:2px">4.2 MB · 4:14</div></div></div>' +
      '<div style="height:3px;border-radius:2px;background:rgba(255,255,255,.12);margin-top:14px">' +
      '<i style="display:block;height:100%;width:100%;background:var(--forest-400);border-radius:2px"></i></div>' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:7px">Upload complete</div></div>' +

      '<div class="field"><div class="field__l">Title</div><input class="field__i" value="Ayeyi Bɛn"></div>' +
      '<div class="field"><div class="field__l">Category</div><input class="field__i" value="Songs"></div>' +
      '<div class="field"><div class="field__l">Cover art</div>' +
      '<div style="display:flex;gap:8px">' +
      D.COVERS.map(function (c, i) {
        return '<div style="width:62px;height:62px;border-radius:12px;overflow:hidden;border:2px solid ' +
          (i === 0 ? 'var(--gold-400)' : 'transparent') + '"><img src="' + c + '" alt="" style="width:100%;height:100%;object-fit:cover"></div>';
      }).join('') +
      '<div style="width:62px;height:62px;border-radius:12px;border:1.5px dashed rgba(255,255,255,.2);display:grid;place-items:center;color:var(--text-3)">' + ic('plus') + '</div>' +
      '</div><div style="font-size:10.5px;color:var(--text-3);margin-top:6px">No artwork? We assign a brand cover automatically.</div></div>' +

      '<div style="padding:8px 18px 0"><button class="btn btn--forest btn--wide" data-act="submitted">' + ic('check') + 'Submit for approval</button>' +
      '<button class="btn btn--ghost btn--wide" style="margin-top:9px" data-go="artiste-studio">Save as draft</button></div>' +
      '</div></div>';
  };

  /* --- Admin --------------------------------------------------------------- */

  SCREENS.admin = function () {
    var seg = [['overview', 'Overview'], ['approvals', 'Approvals'], ['users', 'Users'], ['content', 'Content'], ['analytics', 'Analytics']];
    var body = '';

    if (state.adminTab === 'overview') {
      body = '<div class="stats">' +
        '<div class="stat stat--forest"><div class="stat__n">' + S.songs + '</div><div class="stat__l">Songs</div></div>' +
        '<div class="stat stat--gold"><div class="stat__n">' + S.sermons + '</div><div class="stat__l">Sermons</div></div>' +
        '<div class="stat"><div class="stat__n">' + S.sessions + '</div><div class="stat__l">Sessions</div></div>' +
        '<div class="stat"><div class="stat__n">' + S.listeningNow + '</div><div class="stat__l">Listening now</div></div>' +
        '</div>' +
        '<div class="sect__head"><h2 class="sect__title">Needs attention</h2></div>' +
        '<div class="row" data-admin="approvals"><div class="row__art" style="display:grid;place-items:center;background:rgba(255,183,0,.14);color:var(--gold-300)">' + ic('hourglass') + '</div>' +
        '<div class="row__main"><div class="row__title">' + D.PENDING.length + ' releases awaiting approval</div>' +
        '<div class="row__sub">Oldest waiting 2 days</div></div>' + ic('chevR') + '</div>' +
        '<div class="row" data-admin="content"><div class="row__art" style="display:grid;place-items:center;background:rgba(29,155,240,.14);color:#7cc9fb">' + ic('link') + '</div>' +
        '<div class="row__main"><div class="row__title">' + S.unlinkedReleases + ' unlinked releases</div>' +
        '<div class="row__sub">Legacy uploads with no artiste</div></div>' + ic('chevR') + '</div>' +
        '<div class="sect"><div class="sect__head"><h2 class="sect__title">Recent activity</h2></div>' +
        [['Ayeyi Bɛn approved', 'Obogu Seth · 14 min ago'], ['Op. Abraham verified', 'Admin · 2 h ago'],
        ['Convention sermon uploaded', 'Okyeman Zone · 5 h ago'], ['12 new signups', 'Today']].map(function (l) {
          return '<div class="log"><div class="log__dot"></div><div><div class="log__t">' + esc(l[0]) + '</div>' +
            '<div class="log__d">' + esc(l[1]) + '</div></div></div>';
        }).join('') + '</div>';
    } else if (state.adminTab === 'approvals') {
      body = '<div class="notice">' + D.PENDING.length + ' releases are queued. Approve passes them to the public catalogue; reject sends a note back to the artiste.</div>' +
        D.PENDING.map(function (p) {
          return '<div style="margin:0 18px 12px;padding:14px;border-radius:16px;background:var(--surface);border:1px solid var(--line)">' +
            '<div style="display:flex;gap:12px;align-items:center">' +
            '<div style="width:48px;height:48px;border-radius:10px;overflow:hidden;flex:none"><img src="' + esc(D.coverFor(p.title)) + '" alt="" style="width:100%;height:100%;object-fit:cover"></div>' +
            '<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:600">' + esc(p.title) + '</div>' +
            '<div style="font-size:11.5px;color:var(--text-3);margin-top:2px">' + esc(p.artist) + ' · ' + esc(p.cat) + '</div></div></div>' +
            '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button class="btn btn--forest" style="flex:1;height:38px;font-size:12.5px" data-act="approve">' + ic('check') + 'Approve</button>' +
            '<button class="btn btn--ghost" style="flex:1;height:38px;font-size:12.5px" data-act="reject">' + ic('x') + 'Reject</button>' +
            '</div></div>';
        }).join('');
    } else if (state.adminTab === 'users') {
      body = ARTISTES.map(function (a) {
        return '<div class="row"><div class="row__art" style="border-radius:50%"><img src="' + (a.avatar || D.coverFor(a.name)) + '" alt=""></div>' +
          '<div class="row__main"><div class="row__title">' + esc(a.name) + (a.verified ? ' ' + ver() : '') + '</div>' +
          '<div class="row__sub">' + esc(a.tier === 'admin' ? 'Admin' : 'Artiste') + ' · ' + esc(a.zone) + '</div></div>' +
          '<span class="chip' + (a.tier === 'admin' ? ' chip--gold' : '') + '">' + (a.tier === 'admin' ? 'Admin' : 'Artiste') + '</span></div>';
      }).join('');
    } else if (state.adminTab === 'content') {
      body = '<div class="notice">' + S.unlinkedReleases + ' legacy uploads have no artiste attached. Link them to the right ministry and they appear on that artiste\'s page.</div>' +
        SONGS.slice(8, 14).map(function (s) {
          return '<div class="row"><div class="row__art"><img src="' + esc(s.cover) + '" alt=""></div>' +
            '<div class="row__main"><div class="row__title">' + esc(s.title) + '</div>' +
            '<div class="row__sub">No artiste · uploaded 2024</div></div>' +
            '<button class="chip" data-act="link">Link</button></div>';
        }).join('');
    } else {
      body = '<div class="stats">' +
        '<div class="stat stat--forest"><div class="stat__n">' + S.plays + '</div><div class="stat__l">Play events</div></div>' +
        '<div class="stat stat--gold"><div class="stat__n">' + S.sessions + '</div><div class="stat__l">App sessions</div></div>' +
        '<div class="stat"><div class="stat__n">' + S.listeningNow + '</div><div class="stat__l">Listening now</div></div>' +
        '<div class="stat"><div class="stat__n">' + S.activeHour + '</div><div class="stat__l">Peak hour plays</div></div>' +
        '</div>' +
        '<div class="sect__head"><h2 class="sect__title">Sessions · last 7 days</h2></div>' +
        '<div class="bars-mini">' + [42, 58, 34, 74, 50, 88, 62].map(function (h) {
          return '<div style="height:' + h + '%"></div>';
        }).join('') + '</div>' +
        '<div style="display:flex;justify-content:space-between;padding:0 18px;font-size:10px;color:var(--text-3)">' +
        '<span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>' +
        '<div class="sect"><div class="sect__head"><h2 class="sect__title">Top content</h2></div>' +
        songList(SONGS.slice(0, 5), { rank: true }) + '</div>' +
        '<div class="sect"><div class="sect__head"><h2 class="sect__title">Catalogue health</h2></div>' +
        '<div class="row"><div class="row__main"><div class="row__title">Songs missing cover art</div>' +
        '<div class="row__sub">278 of ' + S.songs + '</div></div>' +
        '<div style="font-family:var(--font-display);font-size:14px;font-weight:800;color:var(--gold-300)">96%</div></div>' +
        '<div class="row"><div class="row__main"><div class="row__title">Releases without an artiste</div>' +
        '<div class="row__sub">Legacy uploads</div></div>' +
        '<div style="font-family:var(--font-display);font-size:14px;font-weight:800;color:var(--gold-300)">' + S.unlinkedReleases + '</div></div>' +
        '</div>' +
        '<div class="notice notice--gold"><b>Read this as an investor.</b> The dashboard is instrumented end to end — plays, sessions, retention and catalogue health all land in one place, so growth is measurable from day one.</div>';
    }

    return '<div class="screen"><div class="scroll">' +
      header('Admin', 'kofi kay', { back: ['account'] }) +
      '<div class="seg">' + seg.map(function (s) {
        return '<button class="' + (s[0] === state.adminTab ? 'on' : '') + '" data-admin="' + s[0] + '">' + s[1] + '</button>';
      }).join('') + '</div>' + body + '</div></div>';
  };

  /* --- Player + sheets ----------------------------------------------------- */

  SCREENS.player = function () {
    var s = state.song;
    var fav = isFav(s.id);
    return '<div class="screen screen--player"><div class="player">' +
      '<div class="player__top">' +
      '<button class="icon-btn" data-go="discover">' + ic('chevD') + '</button>' +
      '<div style="text-align:center"><div style="font-size:9.5px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:var(--gold-300)">Now playing</div>' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:2px">' + esc(s.choir) + '</div></div>' +
      '<button class="icon-btn">' + ic('list') + '</button>' +
      '</div>' +

      '<div class="player__art"><img src="' + esc(s.cover) + '" alt=""></div>' +

      '<div class="player__info">' +
      '<div style="display:flex;align-items:flex-start;gap:10px">' +
      '<div style="flex:1;min-width:0"><h1 class="player__title">' + esc(s.title) + '</h1>' +
      '<p class="player__artist">' + esc(s.artist) + '</p></div>' +
      '<button class="icon-btn" style="margin-top:3px" data-fav="' + s.id + '">' +
      '<span style="color:' + (fav ? 'var(--support)' : 'currentColor') + '">' + ic('heart') + '</span></button>' +
      '</div>' +

      '<div class="player__bar">' +
      '<div class="player__track"><i></i></div>' +
      '<div class="player__times"><span>1:38</span><span>-' + fmt(s.sec - 98) + '</span></div>' +
      '</div>' +

      '<div class="player__ctl">' +
      '<button class="player__btn">' + ic('shuffle') + '</button>' +
      '<button class="player__btn">' + ic('prev') + '</button>' +
      '<button class="player__btn player__btn--big" data-toggle="1">' + icf(state.playing ? 'pause' : 'play') + '</button>' +
      '<button class="player__btn">' + ic('next') + '</button>' +
      '<button class="player__btn">' + ic('repeat') + '</button>' +
      '</div>' +

      '<div class="player__extras">' +
      '<button data-sheet="lyrics">' + ic('quote') + '</button>' +
      '<button>' + ic('download') + '</button>' +
      '<button data-sheet="queue">' + ic('list') + '</button>' +
      '<button>' + ic('plus') + '</button>' +
      '</div>' +
      '</div></div></div>';
  };

  var LYRIC_LINES = [
    ['Ayeyi bɛn na mede bɛma wo?', 0],
    ['Ɔhene a ɔwɔ soro no', 6],
    ['W’adom nti na mete ase', 12],
    ['Mede m’ano bɛkamfo wo daa', 19],
    ['[Chorus]', 26],
    ['Ayeyi! Ayeyi!', 27],
    ['Ɛyɛ wo na ɛsɛ sɛ yɛhyira wo', 34],
    ['Ɔboadeɛ, w’adom nni kabea', 41],
    ['[Verse 2]', 50],
    ['Wɔn a wɔte soro hɔ no', 51],
    ['Wɔto dwom ma wo daa', 58],
    ['Na me nso meka ho bi', 65]
  ];

  function renderOverlay() {
    var o = el('overlay');
    var s = state.song;

    if (state.overlay === 'lyrics') {
      o.innerHTML =
        '<div class="scrim" data-close="1"></div>' +
        '<div class="sheet">' +
        '<div class="sheet__grab"></div>' +
        '<div class="sheet__head">' +
        '<div style="flex:1"><h2 class="sheet__title">Lyrics</h2>' +
        '<div style="font-size:11px;color:var(--text-3);margin-top:2px">' + esc(s.title) + ' · ' + esc(s.artist) + '</div></div>' +
        '<button class="icon-btn" data-close="1">' + ic('x') + '</button>' +
        '</div>' +
        '<div class="sheet__body">' +
        LYRIC_LINES.map(function (l, i) {
          var on = i === 4;
          return '<div class="lyric' + (on ? ' lyric--on' : '') + '">' + esc(l[0]) +
            (on ? '<div class="lyric__tl">Synced · 0:26</div>' : '') + '</div>';
        }).join('') +
        '<div class="notice" style="margin:18px 0 0">Lyrics are stored per release and can be synced to timestamps. Uploaded by the artiste in Studio, editable by admin.</div>' +
        '</div></div>';
      return;
    }

    if (state.overlay === 'queue') {
      var upNext = SONGS.filter(function (x) { return x.id !== s.id; }).slice(0, 8);
      o.innerHTML =
        '<div class="scrim" data-close="1"></div>' +
        '<div class="sheet">' +
        '<div class="sheet__grab"></div>' +
        '<div class="sheet__head">' +
        '<div style="flex:1"><h2 class="sheet__title">Queue</h2>' +
        '<div style="font-size:11px;color:var(--text-3);margin-top:2px">' + (upNext.length + 1) + ' tracks · from Discover</div></div>' +
        '<button class="icon-btn" data-close="1">' + ic('x') + '</button>' +
        '</div>' +
        '<div class="sheet__body">' +
        '<div class="sect__head" style="padding-left:0"><h2 class="sect__title">Now playing</h2></div>' +
        row(s, { time: false }) +
        '<div class="sect__head" style="padding-left:0"><h2 class="sect__title">Up next</h2></div>' +
        upNext.map(function (x) { return row(x); }).join('') +
        '</div></div>';
      return;
    }

    o.innerHTML = '';
  }

  /* --- boot ---------------------------------------------------------------- */

  function render() {
    var fn = SCREENS[state.screen];
    el('screen').innerHTML = fn ? fn() : SCREENS.discover();
    renderChrome();
    renderOverlay();
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var toggle = t.closest('[data-toggle]');
    if (toggle) { state.playing = !state.playing; render(); return; }

    var fav = t.closest('[data-fav]');
    if (fav) { toggleFav(fav.getAttribute('data-fav')); return; }

    var play = t.closest('[data-play]');
    if (play) { var sg = byId(play.getAttribute('data-play')); if (sg) playSong(sg); return; }

    var sheet = t.closest('[data-sheet]');
    if (sheet) { state.overlay = sheet.getAttribute('data-sheet'); render(); return; }

    var close = t.closest('[data-close]');
    if (close) { state.overlay = null; render(); return; }

    var seg = t.closest('[data-seg]');
    if (seg) { go(seg.getAttribute('data-seg')); return; }

    var studio = t.closest('[data-studio]');
    if (studio) { state.studioTab = studio.getAttribute('data-studio'); render(); return; }

    var admin = t.closest('[data-admin]');
    if (admin) { state.adminTab = admin.getAttribute('data-admin'); render(); return; }

    var tab = t.closest('[data-tab]');
    if (tab) {
      var id = tab.getAttribute('data-tab');
      var map = { home: 'discover', trending: 'trending', library: 'favorites', messages: 'messages', account: 'account' };
      go(map[id] || 'discover');
      return;
    }

    var pay = t.closest('[data-pay]');
    if (pay) { state.payment = pay.getAttribute('data-pay'); render(); return; }

    var act = t.closest('[data-act]');
    if (act) {
      var a = act.getAttribute('data-act');
      if (a === 'subscribe' || a === 'submitted' || a === 'approve' || a === 'reject' || a === 'link') {
        state.savedPlan = a;
        act.closest('.btn, .chip') && (act.closest('.btn, .chip').textContent = 'Saved ✓');
      }
      return;
    }

    var g = t.closest('[data-go]');
    if (g) {
      var ctx = g.getAttribute('data-ctx');
      go(g.getAttribute('data-go'), ctx === null ? undefined : ctx);
      return;
    }
  });

  /* live clock */
  function tickClock() {
    var d = new Date();
    var h = d.getHours() % 12 || 12;
    var m = d.getMinutes();
    el('clock').textContent = h + ':' + (m < 10 ? '0' : '') + m;
  }
  tickClock();
  setInterval(tickClock, 10000);

  render();
})();
