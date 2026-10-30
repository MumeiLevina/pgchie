/* One native audio element; every surface is a controller of this instance. */
(() => {
  'use strict';
  const cfg = window.SITE_CONFIG || {};
  const options = cfg.music || {};
  const audio = document.getElementById('audioPlayer');
  if (!audio || audio.dataset.initialized) return;
  audio.dataset.initialized = 'true';
  const $ = (id) => document.getElementById(id);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const dialog = $('musicDialog');
  const fallback = 'assets/music-cover.svg';
  const storageKey = 'chie.music.v1';
  const url = (value) => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const parsed = new URL(value.trim(), document.baseURI);
      return ['http:', 'https:', 'file:'].includes(parsed.protocol) ? parsed.href : '';
    } catch { return ''; }
  };
  // Legacy public playlist stays canonical. Nested playlist is accepted for migrated configs.
  const raw = Array.isArray(cfg.playlist) ? cfg.playlist : options.playlist;
  const ids = new Set();
  const tracks = (options.enabled === false || !Array.isArray(raw) ? [] : raw).flatMap((item) => {
    if (!item || !url(item.src)) return [];
    const src = url(item.src);
    let id = String(item.id || src);
    if (ids.has(id)) id = `${id}:${ids.size}`;
    ids.add(id);
    return [{ id, src, title: String(item.title || 'Untitled'), artist: String(item.artist || 'Unknown artist'),
      cover: url(item.cover) || new URL(fallback, document.baseURI).href,
      accent: /^#[\da-f]{6}$/i.test(item.accent || '') ? item.accent : '#A9DDEB', duration: null }];
  });
  let saved = {};
  if (options.rememberPreferences !== false) {
    try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { /* storage is optional */ }
  }
  const clamp = (v) => Math.max(0, Math.min(1, v));
  audio.volume = clamp(Number.isFinite(saved.volume) ? saved.volume : Number.isFinite(options.defaultVolume) ? options.defaultVolume : 0.65);
  const modes = ['off', 'all', 'one'];
  let repeat = modes.includes(saved.repeat) ? saved.repeat : modes.includes(options.repeatMode) ? options.repeatMode : 'all';
  let shuffle = typeof saved.shuffle === 'boolean' ? saved.shuffle : options.shuffle === true;
  let index = Math.max(0, tracks.findIndex((t) => t.id === saved.track));
  let requested = false;
  let revision = 0;
  let history = [];
  let bag = [];
  let opener = null;
  let miniDismissed = false;
  let miniForced = false;
  let hasStarted = false;
  let widgetVisible = true;
  let mailboxVisible = false;
  let context, analyser, source, frame = 0;
  let visualizationFailed = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const playing = () => !audio.paused && !audio.ended && !audio.error;
  const persist = () => {
    if (options.rememberPreferences === false) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ volume: audio.volume, shuffle, repeat, track: tracks[index]?.id })); } catch { /* private mode / quota */ }
  };
  const time = (seconds) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—:—';
  const setStatus = (message) => {
    $('musicStatus').textContent = message;
    $('playerStatus').textContent = message;
  };
  function updateMini() {
    $('musicMini').hidden = !tracks.length || miniDismissed || (widgetVisible && !miniForced) || mailboxVisible || dialog.open || (!hasStarted && !miniForced);
  }
  function renderState() {
    const active = playing();
    all('[data-music="play"]').forEach((button) => {
      button.textContent = active ? '❚❚' : '▶';
      button.setAttribute('aria-label', active ? 'Tạm dừng nhạc' : 'Phát nhạc');
    });
    all('.vinyl').forEach((disc) => disc.classList.toggle('playing', active));
    rows.forEach((row, i) => {
      row.button.setAttribute('aria-current', i === index ? 'true' : 'false');
      row.indicator.textContent = i === index && active ? '♫' : String(i + 1).padStart(2, '0');
    });
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = active ? 'playing' : 'paused';
    updateMini();
    visualize();
  }
  function renderModes() {
    const shuffleButton = document.querySelector('[data-music="shuffle"]');
    shuffleButton.setAttribute('aria-pressed', String(shuffle));
    const repeatButton = document.querySelector('[data-music="repeat"]');
    repeatButton.textContent = repeat === 'one' ? '↻¹' : '↻';
    repeatButton.setAttribute('aria-pressed', String(repeat !== 'off'));
    repeatButton.setAttribute('aria-label', `Lặp lại: ${{ off: 'tắt', all: 'tất cả', one: 'một bài' }[repeat]}`);
  }
  function updateTime() {
    const duration = audio.duration;
    const available = Number.isFinite(duration) && duration > 0;
    $('musicSeek').disabled = !available;
    $('musicSeek').max = available ? duration : 0;
    $('musicSeek').value = available ? audio.currentTime : 0;
    $('musicSeek').setAttribute('aria-valuetext', `${time(audio.currentTime)} / ${time(duration)}`);
    $('musicCurrent').textContent = time(audio.currentTime);
    $('musicDuration').textContent = available ? time(duration) : '—:—';
    if (available && tracks[index]) {
      tracks[index].duration = duration;
      rows[index].duration.textContent = time(duration);
      if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
        try { navigator.mediaSession.setPositionState({ duration, playbackRate: audio.playbackRate, position: Math.min(duration, Math.max(0, audio.currentTime)) }); } catch { /* optional API */ }
      }
    }
  }
  function coverImage(img, track, lazy = false) {
    img.alt = '';
    img.loading = lazy ? 'lazy' : 'eager';
    img.decoding = 'async';
    img.onerror = () => { img.onerror = null; img.src = fallback; };
    img.src = track.cover;
  }
  const rows = [];
  const fragment = document.createDocumentFragment();
  tracks.forEach((track, i) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'queue-track';
    button.dataset.trackIndex = i;
    const indicator = document.createElement('span');
    indicator.className = 'queue-number';
    indicator.setAttribute('aria-hidden', 'true');
    const cover = document.createElement('img');
    coverImage(cover, track, true);
    cover.width = cover.height = 42;
    const copy = document.createElement('span');
    copy.className = 'queue-copy';
    const title = document.createElement('strong'); title.textContent = track.title;
    const artist = document.createElement('span'); artist.textContent = track.artist;
    copy.append(title, artist);
    const duration = document.createElement('span'); duration.className = 'queue-duration'; duration.textContent = '—:—';
    button.append(indicator, cover, copy, duration);
    li.append(button); fragment.append(li);
    rows.push({ button, indicator, duration });
  });
  $('musicPlaylist').append(fragment);
  $('musicPlaylist').addEventListener('click', (event) => {
    const button = event.target.closest('[data-track-index]');
    if (!button) return;
    const selected = Number(button.dataset.trackIndex);
    if (selected !== index) { history.push(index); bag = []; select(selected); if (shuffle) shuffledNextAndRestore(); }
    play();
  });
  $('queueCount').textContent = `${tracks.length} bài`;
  $('playlistEmpty').hidden = !!tracks.length;
  all('[data-music]').forEach((button) => {
    if (!['expand', 'close', 'dismiss'].includes(button.dataset.music)) button.disabled = !tracks.length;
  });
  $('musicVolume').disabled = !tracks.length;
  if (options.enabled === false) {
    document.querySelector('.music-widget').hidden = true;
    return;
  }
  const artistLink = $('artistLink');
  if (url(cfg.artistUrl)) artistLink.href = url(cfg.artistUrl);
  function select(next) {
    revision++;
    requested = false;
    audio.pause();
    index = next;
    const track = tracks[index];
    // Do not preload the queue or even the first song on page load.
    audio.preload = 'none';
    audio.removeAttribute('src');
    audio.load();
    all('[data-track-title]').forEach((node) => { node.textContent = track.title; });
    all('[data-track-artist]').forEach((node) => { node.textContent = track.artist; });
    all('[data-cover]').forEach((img) => coverImage(img, track));
    dialog.style.setProperty('--record-accent', track.accent);
    if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: "Chie's Little Universe", artwork: [{ src: track.cover }] }); } catch { /* optional */ }
    }
    setStatus('Sẵn sàng khi bạn muốn nghe ♡');
    updateTime(); renderState(); persist();
  }
  function prepareAnalysis() {
    // Remote sources without CORS can become silent when routed through Web Audio.
    // Leave those on native playback. Local assets are safe to analyse.
    if (context || visualizationFailed || options.visualizer === false || reduced.matches || tracks.some((track) => new URL(track.src).origin !== location.origin)) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      context = new AudioContext();
      analyser = context.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      context.addEventListener('statechange', visualize);
    } catch {
      visualizationFailed = true;
      if (source && context) {
        try { source.disconnect(); source.connect(context.destination); } catch { /* native fallback when no source created */ }
      }
    }
  }
  async function play() {
    if (!tracks.length) return;
    requested = true;
    hasStarted = true;
    const ticket = ++revision;
    if (!audio.getAttribute('src')) { audio.src = tracks[index].src; audio.load(); }
    prepareAnalysis();
    if (context?.state === 'suspended') context.resume().catch(() => {});
    setStatus('Đang tải giai điệu…');
    try {
      await audio.play();
      if (ticket !== revision) return;
      setStatus('Đang phát · enjoy your little daydream ♡');
      renderState();
    } catch (error) {
      if (ticket !== revision || !requested || error.name === 'AbortError') return;
      requested = false;
      setStatus(error.name === 'NotAllowedError' ? 'Trình duyệt đang chặn âm thanh. Bấm phát để thử lại nhé.' : 'Không phát được tệp nhạc. Kiểm tra đường dẫn, định dạng hoặc quyền truy cập.');
      renderState();
    }
  }
  function pause() {
    requested = false; revision++; audio.pause();
    setStatus('Tạm dừng · take your time ♡'); renderState();
  }
  function shuffledNext() {
    if (!bag.length) {
      bag = tracks.map((_, i) => i).filter((i) => i !== index);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop() ?? index;
  }
  function advance(direction, ended = false) {
    if (!tracks.length) return;
    const resume = requested || playing() || ended;
    if (ended && repeat === 'one') { audio.currentTime = 0; play(); return; }
    if (ended && repeat === 'off' && (shuffle ? !bag.length : index === tracks.length - 1)) {
      requested = false; setStatus('Mixtape đã kết thúc ♡'); renderState(); return;
    }
    if (direction < 0 && audio.currentTime > 3) { audio.currentTime = 0; if (resume) play(); return; }
    let next;
    if (direction < 0) next = history.pop() ?? (index - 1 + tracks.length) % tracks.length;
    else { history.push(index); if (history.length > 200) history.shift(); next = shuffle ? shuffledNext() : (index + 1) % tracks.length; }
    select(next);
    if (resume) play();
  }
  function openPlayer(button) {
    opener = button;
    miniForced = false;
    dialog.showModal();
    document.body.classList.add('music-dialog-open');
    updateMini(); visualize();
  }
  const actions = {
    play: () => requested || playing() ? pause() : play(),
    previous: () => advance(-1), next: () => advance(1),
    expand: openPlayer, close: () => dialog.close(),
    minimize: () => { miniForced = true; miniDismissed = false; dialog.close(); },
    dismiss: () => { miniDismissed = true; miniForced = false; updateMini(); },
    shuffle: () => { shuffle = !shuffle; bag = []; history = []; if (shuffle) shuffledNextAndRestore(); renderModes(); persist(); },
    repeat: () => { repeat = modes[(modes.indexOf(repeat) + 1) % modes.length]; renderModes(); persist(); },
    mute: () => { const unmute = audio.muted || audio.volume === 0; if (audio.volume === 0) audio.volume = 0.65; audio.muted = !unmute; }
  };
  function shuffledNextAndRestore() { const next = shuffledNext(); if (next !== index) bag.push(next); }
  all('[data-music]').forEach((button) => button.addEventListener('click', () => actions[button.dataset.music]?.(button)));
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('music-dialog-open');
    updateMini();
    if (miniForced && !$('musicMini').hidden) $('musicMini').querySelector('[data-music="expand"]').focus({ preventScroll: true });
    else if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus();
    else document.querySelector('.music-expand').focus();
    visualize();
  });
  $('musicSeek').addEventListener('input', (event) => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, Number(event.target.value));
    updateTime();
  });
  $('musicVolume').addEventListener('input', (event) => { audio.volume = Number(event.target.value); audio.muted = false; });
  function volumeChanged() {
    $('musicVolume').value = audio.volume;
    $('volumeValue').textContent = `${Math.round(audio.volume * 100)}%`;
    const muted = audio.muted || audio.volume === 0;
    const button = document.querySelector('[data-music="mute"]');
    button.textContent = muted ? '♪̸' : '♪';
    button.setAttribute('aria-label', muted ? 'Bật tiếng' : 'Tắt tiếng');
    button.setAttribute('aria-pressed', String(muted));
    persist();
  }
  audio.addEventListener('volumechange', volumeChanged);
  ['timeupdate', 'loadedmetadata', 'durationchange'].forEach((event) => audio.addEventListener(event, updateTime));
  audio.addEventListener('playing', () => { setStatus('Đang phát · enjoy your little daydream ♡'); renderState(); });
  audio.addEventListener('pause', () => {
    if (audio.paused && !audio.ended && !audio.error) { requested = false; setStatus('Tạm dừng · take your time ♡'); }
    renderState();
  });
  audio.addEventListener('waiting', () => { if (requested) setStatus('Đang tải giai điệu…'); });
  audio.addEventListener('ended', () => advance(1, true));
  audio.addEventListener('error', () => {
    if (!audio.error) return;
    requested = false; revision++;
    setStatus('Không tải được tệp nhạc. Kiểm tra tên tệp, đường dẫn và định dạng âm thanh.');
    renderState();
  });
  const canvas = $('musicVisualizer');
  const painter = canvas.getContext('2d');
  let data;
  function visualize() {
    cancelAnimationFrame(frame); frame = 0;
    const enabled = analyser && !visualizationFailed && !reduced.matches && !document.hidden && dialog.open && playing() && context.state === 'running';
    canvas.hidden = !enabled;
    if (!enabled || !painter) return;
    data ||= new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      analyser.getByteFrequencyData(data);
      painter.clearRect(0, 0, canvas.width, canvas.height);
      painter.fillStyle = '#75b7c8';
      const count = 40, width = canvas.width / count;
      for (let i = 0; i < count; i++) {
        const height = (data[i + 1] / 255) * (canvas.height - 4);
        painter.fillRect(i * width + 3, (canvas.height - height) / 2, width - 6, height);
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
  }
  reduced.addEventListener('change', visualize);
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('page-hidden', document.hidden);
    visualize();
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target.matches('.music-widget')) widgetVisible = entry.isIntersecting;
        else mailboxVisible = entry.isIntersecting;
      });
      updateMini();
    });
    observer.observe(document.querySelector('.music-widget'));
    observer.observe($('letters'));
    window.addEventListener('pagehide', (event) => {
      cancelAnimationFrame(frame);
      if (!event.persisted) { observer.disconnect(); context?.close().catch(() => {}); }
    });
    window.addEventListener('pageshow', () => { updateMini(); visualize(); });
  }
  if ('mediaSession' in navigator) {
    const handlers = { play, pause, previoustrack: () => advance(-1), nexttrack: () => advance(1),
      seekto: (event) => { if (Number.isFinite(audio.duration) && Number.isFinite(event.seekTime)) audio.currentTime = Math.max(0, Math.min(audio.duration, event.seekTime)); } };
    Object.entries(handlers).forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* browser-specific support */ } });
  }
  renderModes(); volumeChanged();
  if (tracks.length) { if (shuffle) shuffledNextAndRestore(); select(index); }
  else { setStatus('Chưa có bài hát · hẹn bạn những giai điệu mới ✧'); renderState(); }
  // Autoplay is deliberately never invoked, including restored sessions.
})();
