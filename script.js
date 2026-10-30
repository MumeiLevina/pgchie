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

  // The shared native music engine lives in music.js.

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
  let sending = false;
  message.addEventListener('input', () => { count.textContent = `${message.value.length} / 500`; message.removeAttribute('aria-invalid'); });
  function report(text, type = 'error') {
    status.textContent = text;
    status.className = `form-status ${type}`;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    if (byId('honeypot').value) { report('Không thể gửi biểu mẫu này.'); return; }
    const content = message.value.trim();
    if (!content) { report('Bạn chưa viết gì cả nè ♡'); message.setAttribute('aria-invalid', 'true'); message.focus(); return; }
    if (message.value.length > 500) { report('Tin nhắn vượt quá 500 ký tự.'); return; }
    if (!/^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(endpoint)) {
      report('Hộp thư chưa sẵn sàng gửi. Bạn giữ lại lời nhắn và quay lại sau nhé ✧');
      return;
    }
    sending = true;
    submit.disabled = true;
    message.readOnly = true;
    form.setAttribute('aria-busy', 'true');
    submit.textContent = 'sending... ✧';
    report('Đang gửi lời nhắn...', '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, _gotcha: '', source: 'Chie Little Universe' })
      });
      if (!response.ok) throw new Error('Form submission failed');
      const result = await response.json();
      if (result.ok !== true || result.errors?.length) throw new Error('Formspree did not confirm delivery');
      message.value = '';
      count.textContent = '0 / 500';
      report('Thư của bạn đã được gửi đến Chie rồi! Cảm ơn bạn vì lời nhắn đáng yêu này ♡', 'success');
    } catch {
      report('Thư chưa gửi được. Bạn thử lại một chút nữa nhé ✧');
    } finally {
      clearTimeout(timeout);
      sending = false;
      message.readOnly = false;
      form.removeAttribute('aria-busy');
      submit.disabled = false;
      submit.innerHTML = 'send my letter <span aria-hidden="true">↗</span>';
    }
  });
})();
