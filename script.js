(() => {
  'use strict';
  const cfg = window.SITE_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const byId = (id) => document.getElementById(id);

  function validWebUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try { const u = new URL(value.trim()); return ['https:', 'http:'].includes(u.protocol); }
    catch { return false; }
  }
  function setText(id, text) { if (byId(id) && typeof text === 'string' && text.trim()) byId(id).textContent = text; }
  function setImage(id, url) {
    if (typeof url !== 'string' || !url.trim()) return;
    let resolved;
    try { resolved = new URL(url.trim(), document.baseURI); }
    catch { return; }
    if (!['https:', 'http:', 'file:'].includes(resolved.protocol)) return;
    const img = byId(id);
    if (!img) return;
    const previous = img.src;
    img.addEventListener('error', () => { img.src = previous; }, { once: true });
    img.src = resolved.href;
  }

  // Profile details
  const displayName = String(cfg.displayName || 'Chie');
  const brandName = String(cfg.brandName || 'chie');
  setText('heroName', displayName);
  setText('brandName', brandName);
  setText('footerName', brandName);
  setText('heroBio', cfg.bio);
  setText('status-title', `${displayName} ✿`);
  document.title = `${displayName}'s Little Universe ✦`;
  setImage('siteBackgroundGif', cfg.backgroundGifUrl);
  setImage('heroGif', cfg.heroGifUrl);
  setImage('moodGif', cfg.moodGifUrl);
  if (validWebUrl(cfg.clockGifUrl)) {
    const clock = $('.clock-widget');
    // The tint stays for legibility even if the user chooses a bright GIF.
    clock.style.backgroundImage = `linear-gradient(110deg,rgba(133,210,218,.78),rgba(178,226,237,.75)),url("${cfg.clockGifUrl.replace(/["\\\n\r]/g, '')}")`;
    clock.style.backgroundSize = 'cover';
    clock.style.backgroundPosition = 'center';
  }

  // Social cards. Blank links are inert and explicitly labelled instead of pointing to '#'.
  document.querySelectorAll('[data-social]').forEach((card) => {
    const kind = card.dataset.social;
    const url = cfg.socials && cfg.socials[kind];
    if (validWebUrl(url)) {
      card.href = url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.removeAttribute('aria-disabled');
    } else {
      card.removeAttribute('href');
      card.setAttribute('aria-disabled', 'true');
      card.title = `Chưa cấu hình đường dẫn ${kind}`;
      const desc = card.querySelector('.social-caption');
      if (desc) desc.textContent = 'link coming soon ✧';
    }
  });

  // Local clock, displayed in Viet Nam time regardless of visitor's timezone.
  const clockFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
  const dateFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'short' });
  function renderClock() {
    const now = new Date();
    byId('clockTime').textContent = clockFormatter.format(now);
    const parts = dateFormatter.formatToParts(now);
    const find = (type) => parts.find((p) => p.type === type)?.value || '';
    byId('clockWeekday').textContent = find('weekday');
    byId('clockDate').textContent = `${find('day')} ${find('month')}`;
  }
  renderClock();
  setInterval(renderClock, 15_000);

  // Optional Lanyard Discord presence. Only starts after providing a real user ID.
  const discordId = String(cfg.discordUserId || '').trim();
  const statuses = { online: 'online', idle: 'away', dnd: 'busy', offline: 'offline' };
  if (/^\d{17,21}$/.test(discordId)) {
    const refreshPresence = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7500);
        let response;
        try { response = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`, { signal: controller.signal }); }
        finally { clearTimeout(timeout); }
        if (!response.ok) throw new Error('Discord API unavailable');
        const json = await response.json();
        if (!json.success || !json.data) throw new Error('Discord user unavailable');
        const { discord_status, activities = [] } = json.data;
        const state = statuses[discord_status] || 'unknown';
        byId('presenceText').textContent = state;
        byId('presenceInfo').textContent = '· via Lanyard';
        byId('presenceDot').className = `presence-dot ${['online', 'idle', 'dnd'].includes(discord_status) ? discord_status : ''}`;
        const activity = activities.find((a) => a.type === 0 && a.name) || activities.find((a) => a.name && a.type !== 4);
        byId('activityText').textContent = activity ? `currently into: ${activity.name}` : 'probably listening to music or planning another cosplay...';
      } catch {
        byId('presenceText').textContent = 'status unavailable';
        byId('presenceInfo').textContent = '· connection unavailable';
      }
    };
    refreshPresence();
    setInterval(refreshPresence, 60_000);
  } else {
    byId('presenceText').textContent = 'just vibing ✧';
    byId('presenceInfo').textContent = '· not connected';
  }

  // Optional audio player. Disabled when playlist is empty.
  const playlist = (Array.isArray(cfg.playlist) ? cfg.playlist : []).filter((song) => song && song.title && typeof song.src === 'string' && (/^\.?\/?[\w\-./%]+\.(mp3|ogg|wav)(\?.*)?$/i.test(song.src) || validWebUrl(song.src)));
  const audio = byId('audioPlayer');
  const prev = byId('prevTrack');
  const play = byId('playTrack');
  const next = byId('nextTrack');
  const trackInfo = byId('trackInfo');
  const artistLink = byId('artistLink');
  if (validWebUrl(cfg.artistUrl)) artistLink.href = cfg.artistUrl;
  let index = 0;
  const updatePlaying = () => {
    const playing = !audio.paused && !!audio.currentSrc;
    play.textContent = playing ? '❚❚' : '▶';
    play.setAttribute('aria-label', playing ? 'Tạm dừng nhạc' : 'Phát nhạc');
    $('.vinyl').classList.toggle('playing', playing);
  };
  function loadSong() {
    if (!playlist.length) return;
    const song = playlist[index];
    audio.src = song.src;
    trackInfo.textContent = `${song.title} — ${song.artist || 'Unknown artist'}`;
    audio.load();
    updatePlaying();
  }
  if (playlist.length) {
    [prev, play, next].forEach((button) => button.disabled = false);
    loadSong();
    play.addEventListener('click', async () => {
      if (!audio.paused) { audio.pause(); return; }
      try { await audio.play(); trackInfo.textContent = `${playlist[index].title} — ${playlist[index].artist || 'Unknown artist'}`; }
      catch { trackInfo.textContent = 'Không phát được tệp nhạc. Kiểm tra URL hoặc quyền truy cập.'; }
    });
    function jump(direction) {
      const wasPlaying = !audio.paused;
      index = (index + direction + playlist.length) % playlist.length;
      loadSong();
      if (wasPlaying) audio.play().catch(() => { trackInfo.textContent = 'Không phát được bài nhạc này.'; });
    }
    prev.addEventListener('click', () => jump(-1));
    next.addEventListener('click', () => jump(1));
    audio.addEventListener('ended', () => jump(1));
    audio.addEventListener('play', updatePlaying);
    audio.addEventListener('pause', updatePlaying);
    audio.addEventListener('error', () => { trackInfo.textContent = 'Không tải được nhạc. Vui lòng kiểm tra URL.'; updatePlaying(); });
  } else {
    trackInfo.textContent = 'Gắn link audio trong config.js để mở trình phát nhạc.';
    play.title = 'Chưa có playlist';
  }

  // Image gallery with native, accessible <dialog> lightbox.
  const photoData = [
    ['assets/cosplay-blue.webp', 'Gwen — cosplay'],
    ['assets/cosplay-blonde.webp', 'Marin — cosplay']
  ];
  const photoDialog = byId('photoDialog');
  document.querySelectorAll('[data-photo]').forEach((card) => {
    card.addEventListener('click', () => {
      const selected = photoData[Number(card.dataset.photo)];
      if (!selected) return;
      byId('dialogImage').src = selected[0];
      byId('dialogImage').alt = selected[1];
      byId('dialogCaption').textContent = selected[1];
      if (typeof photoDialog.showModal === 'function') photoDialog.showModal();
    });
  });
  photoDialog.addEventListener('click', (event) => {
    if (event.target === photoDialog) photoDialog.close();
  });

  // Anonymous mailbox. Real POST only when Formspree is configured.
  const form = byId('letterForm');
  const message = byId('letterText');
  const count = byId('letterCount');
  const status = byId('letterStatus');
  const submit = byId('sendLetter');
  const endpoint = String(cfg.anonymousFormEndpoint || '').trim();
  message.addEventListener('input', () => { count.textContent = `${message.value.length} / 500`; });
  function report(text, type = 'error') {
    status.textContent = text;
    status.className = `form-status ${type}`;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (byId('honeypot').value) return;
    const content = message.value.trim();
    if (!content) { report('Bạn chưa viết gì cả nè ♡'); message.focus(); return; }
    if (content.length > 500) { report('Tin nhắn vượt quá 500 ký tự.'); return; }
    if (!/^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(endpoint)) {
      report('', '');
      return;
    }
    submit.disabled = true;
    submit.textContent = 'sending... ✧';
    report('Đang gửi lời nhắn...', '');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, source: 'Chie Little Universe' })
      });
      if (!response.ok) throw new Error('Form submission failed');
      message.value = '';
      count.textContent = '0 / 500';
      report('Đã gửi tin nhắn thành công! Cảm ơn bạn rất nhiều ♡', 'success');
    } catch {
      report('Chưa gửi được tin nhắn. Hãy thử lại sau nhé.');
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'send my letter <span aria-hidden="true">↗</span>';
    }
  });
})();
