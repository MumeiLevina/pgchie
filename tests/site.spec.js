const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const configSource = fs.readFileSync(path.join(__dirname, '../config.js'), 'utf8');
const mp3File = path.join(os.tmpdir(), 'chie-audio-test/signal.mp3');

// A real PCM signal for native browser decoding; no audio files are published.
function waveSignal() {
  const samples = 22050 * 8;
  const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(22050, 24); data.writeUInt32LE(44100, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(7000 * Math.sin(2 * Math.PI * 440 * i / 22050)), 44 + i * 2);
  return data;
}
const signal = waveSignal();
async function serveAudio(route, body, contentType) {
  const range = route.request().headers().range;
  if (!range) return route.fulfill({contentType,body,headers:{'Accept-Ranges':'bytes'}});
  const [, first, last] = /bytes=(\d+)-(\d*)/.exec(range) || [];
  const start=Number(first || 0), end=Math.min(Number(last || body.length-1),body.length-1);
  return route.fulfill({status:206,contentType,body:body.subarray(start,end+1),headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${body.length}`}});
}
const tracks = [0, 1, 2].map(i => ({ id: `t${i}`, title: `Daydream ${i + 1}`, artist: 'Test signal', src: `__test/track${i}.wav`, cover: i === 1 ? 'assets/missing-cover.webp' : 'assets/music-cover.svg' }));
async function boot(page, overrides = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/config.js', route => route.fulfill({contentType:'text/javascript', body: `${configSource}\nObject.assign(window.SITE_CONFIG, ${JSON.stringify({playlist:[],socials:{},...overrides})});`}));
  await page.route('**/__test/*.wav', route => serveAudio(route,signal,'audio/wav'));
  // Avoid external font availability affecting deterministic interaction checks.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({contentType:'text/css',body:''}));
  await page.goto('/');
  await expect(page.locator('#clockTime')).not.toHaveText('--:--');
  return errors;
}
const audioState = page => page.locator('#audioPlayer').evaluate(a => ({paused:a.paused, time:a.currentTime, duration:a.duration, volume:a.volume, muted:a.muted, src:a.src, ended:a.ended, error:a.error?.code}));
async function start(page) {
  await page.locator('#playTrack').click();
  await expect.poll(async () => (await audioState(page)).paused).toBe(false);
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(0.05);
}
async function finish(page) {
  await page.locator('#audioPlayer').evaluate(a => {a.currentTime = a.duration - 0.08;});
}

test('empty playlist, no preload, safe mailbox and existing gallery/clock/images/socials', async ({page}) => {
  let audioRequests = 0;
  page.on('request', req => { if (/\.(mp3|wav|ogg)/.test(req.url())) audioRequests++; });
  const errors = await boot(page);
  await expect(page.locator('#playTrack')).toBeDisabled();
  await expect(page.locator('#musicStatus')).toContainText('Chưa có bài hát');
  await page.locator('.music-expand').click();
  await expect(page.locator('#playlistEmpty')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.music-expand')).toBeFocused();
  await page.locator('[data-photo="0"]').click();
  await expect(page.locator('#photoDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  for (const id of ['heroGif', 'siteBackgroundGif', 'moodGif']) {
    await expect.poll(() => page.locator(`#${id}`).evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('#presenceInfo')).toHaveText('· not connected');
  await expect(page.locator('[data-social="facebook"]')).not.toHaveAttribute('href');
  await page.locator('#letterText').fill('a little hello');
  await page.locator('#sendLetter').click();
  await expect(page.locator('#letterStatus')).toContainText('chưa sẵn sàng');
  await expect(page.locator('#letterText')).toHaveValue('a little hello');
  expect(audioRequests).toBe(0); expect(errors).toEqual([]);
});

test('native WAV play/pause, seek, volume, mute, cover fallback and synchronized controls', async ({page}) => {
  const errors = await boot(page, {playlist: tracks});
  await start(page);
  await expect(page.locator('.music-widget .vinyl')).toHaveClass(/playing/);
  await page.locator('.music-expand').click();
  await expect(page.locator('#musicDialog [data-music="play"]')).toHaveAttribute('aria-label', 'Tạm dừng nhạc');
  await page.locator('#musicSeek').fill('3');
  expect((await audioState(page)).time).toBeGreaterThanOrEqual(3);
  await page.locator('#musicVolume').fill('0.23');
  await expect.poll(async () => (await audioState(page)).volume).toBeCloseTo(0.23);
  await page.locator('[data-music="mute"]').click();
  await expect.poll(async () => (await audioState(page)).muted).toBe(true);
  await page.locator('[data-music="mute"]').click();
  await expect.poll(async () => (await audioState(page)).muted).toBe(false);
  await page.locator('[data-track-index="1"]').click();
  await expect(page.locator('#music-title')).toHaveText('Daydream 2');
  await expect(page.locator('#musicDialog [data-cover]')).toHaveAttribute('src', 'assets/music-cover.svg');
  await expect.poll(async () => (await audioState(page)).paused).toBe(false);
  await page.locator('#musicDialog [data-music="play"]').click();
  await expect.poll(async () => (await audioState(page)).paused).toBe(true);
  await expect(page.locator('.music-widget .vinyl')).not.toHaveClass(/playing/);
  expect(await page.locator('audio').count()).toBe(1); expect(errors).toEqual([]);
});

test('real MP3 decoding and playback', async ({page}) => {
  test.skip(!fs.existsSync(mp3File), 'Run python tests/generate-tone.py for the optional MP3 signal.');
  await page.route('**/__test/signal.mp3', route => serveAudio(route,fs.readFileSync(mp3File),'audio/mpeg'));
  await boot(page, {playlist:[{...tracks[0],src:'__test/signal.mp3'}]});
  await start(page);
  expect((await audioState(page)).duration).toBeGreaterThan(7);
  expect((await audioState(page)).error).toBeUndefined();
});

test('automatic next, repeat all, repeat one, and repeat off at last track', async ({page}) => {
  await boot(page, {playlist:tracks});
  await start(page); await finish(page);
  await expect(page.locator('#music-title')).toHaveText('Daydream 2');
  await expect.poll(async () => (await audioState(page)).paused).toBe(false);
  await page.locator('.music-expand').click();
  await page.locator('[data-track-index="2"]').click();
  await expect.poll(async () => (await audioState(page)).duration).toBeGreaterThan(0);
  await finish(page);
  await expect(page.locator('#music-title')).toHaveText('Daydream 1');
  await page.locator('[data-music="repeat"]').click(); // all -> one
  await expect.poll(async () => (await audioState(page)).duration).toBeGreaterThan(0);
  await finish(page);
  await expect.poll(async () => (await audioState(page)).time).toBeLessThan(2);
  await expect(page.locator('#music-title')).toHaveText('Daydream 1');
  await page.locator('[data-music="repeat"]').click(); // one -> off
  await page.locator('[data-track-index="2"]').click();
  await expect.poll(async () => (await audioState(page)).duration).toBeGreaterThan(0);
  await finish(page);
  await expect(page.locator('#musicStatus')).toContainText('đã kết thúc');
  expect((await audioState(page)).paused).toBe(true);
  await expect(page.locator('#music-title')).toHaveText('Daydream 3');
});

test('single track repeat modes and previous/next stay valid', async ({page}) => {
  await boot(page, {playlist:[tracks[0]]}); await start(page);
  await finish(page);
  await expect.poll(async () => (await audioState(page)).time).toBeLessThan(2);
  await page.locator('#nextTrack').click();
  await page.locator('#prevTrack').click();
  await expect.poll(async () => (await audioState(page)).paused).toBe(false);
  await page.locator('.music-expand').click();
  await page.locator('[data-music="repeat"]').click();
  await page.locator('[data-music="repeat"]').click();
  await expect.poll(async () => (await audioState(page)).duration).toBeGreaterThan(0);
  await finish(page);
  await expect(page.locator('#musicStatus')).toContainText('đã kết thúc');
});

test('shuffle visits every other song once, previous uses history, rapid clicks remain playable', async ({page}) => {
  const errors = await boot(page, {playlist:tracks}); await start(page);
  await page.locator('.music-expand').click();
  await page.locator('[data-music="shuffle"]').click();
  const visited = ['Daydream 1'];
  for(let i = 0; i < 2; i++) {
    await page.locator('#musicDialog [data-music="next"]').click();
    visited.push(await page.locator('#music-title').textContent());
  }
  expect(new Set(visited).size).toBe(3);
  await page.locator('#musicDialog [data-music="previous"]').click();
  await expect(page.locator('#music-title')).toHaveText(visited[1]);
  await page.locator('#musicDialog [data-music="next"]').evaluate(b => { for(let i=0;i<15;i++) b.click(); });
  await expect.poll(async () => (await audioState(page)).paused).toBe(false);
  await page.locator('#musicDialog [data-music="play"]').evaluate(b => { for(let i=0;i<6;i++) b.click(); });
  await expect.poll(async () => (await audioState(page)).paused).toBe(false);
  expect(errors).toEqual([]);
});

test('preferences survive reload without autoplay and blocked storage is harmless', async ({page}) => {
  await boot(page, {playlist:tracks}); await start(page);
  await page.locator('.music-expand').click();
  await page.locator('[data-track-index="1"]').click();
  await page.locator('#musicVolume').fill('0.31');
  await page.locator('[data-music="shuffle"]').click();
  await page.locator('[data-music="repeat"]').click();
  await page.reload();
  await expect(page.locator('#music-title')).toHaveText('Daydream 2');
  expect((await audioState(page)).paused).toBe(true);
  expect((await audioState(page)).volume).toBeCloseTo(0.31);
  await expect(page.locator('[data-music="shuffle"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-music="repeat"]')).toHaveAttribute('aria-label','Lặp lại: một bài');
  await page.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}}));
  await page.reload(); await start(page);
});

test('missing file has understandable error and stopped vinyl', async ({page}) => {
  await boot(page, {playlist:[{...tracks[0],src:'assets/music/not-present.mp3'}]});
  await page.locator('#playTrack').click();
  await expect(page.locator('#musicStatus')).toContainText(/Không (tải|phát) được/);
  await expect(page.locator('.music-widget .vinyl')).not.toHaveClass(/playing/);
  expect((await audioState(page)).paused).toBe(true);
});

test('visualizer reads real analyser data, one graph over track changes, paused/hidden/reduced work stops', async ({page}) => {
  await page.addInitScript(() => {
    window.audioStats = {sources:0, reads:0, peak:0};
    const create = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function(...args) { window.audioStats.sources++; return create.apply(this,args); };
    const read = AnalyserNode.prototype.getByteFrequencyData;
    AnalyserNode.prototype.getByteFrequencyData = function(array) { read.call(this,array); window.audioStats.reads++; window.audioStats.peak=Math.max(window.audioStats.peak,...array); };
  });
  await boot(page, {playlist:tracks});
  await page.locator('.music-expand').click();
  await page.locator('#musicDialog [data-music="play"]').click();
  await expect.poll(() => page.evaluate(() => window.audioStats.peak)).toBeGreaterThan(0);
  await page.locator('#musicDialog [data-music="next"]').click();
  await expect.poll(async () => (await audioState(page)).paused).toBe(false);
  await page.keyboard.press('Escape');
  await page.locator('.music-expand').click();
  expect(await page.evaluate(() => window.audioStats.sources)).toBe(1);
  await page.locator('#musicDialog [data-music="play"]').click();
  const reads = await page.evaluate(() => window.audioStats.reads);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.audioStats.reads)).toBe(reads);
  await page.locator('#musicDialog [data-music="play"]').click();
  await expect.poll(() => page.evaluate(() => window.audioStats.reads)).toBeGreaterThan(reads);
  await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  const hiddenReads = await page.evaluate(() => window.audioStats.reads);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.audioStats.reads)).toBe(hiddenReads);
  await page.evaluate(() => {delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('#musicVisualizer')).toBeHidden();
  await expect(page.locator('.vinyl-large')).toHaveCSS('animation-name','none');
});

test('no AudioContext retains native playback', async ({page}) => {
  await page.addInitScript(() => {window.AudioContext=undefined;window.webkitAudioContext=undefined;});
  await boot(page, {playlist:tracks}); await start(page);
  await page.locator('.music-expand').click();
  await expect(page.locator('#musicVisualizer')).toBeHidden();
});

test('mixed local/remote playlist bypasses Web Audio without CORS muting', async ({page}) => {
  await page.addInitScript(() => {
    window.sourceCount=0;
    const create=AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource=function(...args){window.sourceCount++;return create.apply(this,args);};
  });
  await page.route('https://audio.example.test/signal.wav', route=>serveAudio(route,signal,'audio/wav'));
  await boot(page,{playlist:[tracks[0],{...tracks[1],src:'https://audio.example.test/signal.wav'}]});
  await start(page);
  await page.locator('#nextTrack').click();
  await expect.poll(async()=>(await audioState(page)).time).toBeGreaterThan(0.05);
  expect((await audioState(page)).src).toBe('https://audio.example.test/signal.wav');
  expect(await page.evaluate(()=>window.sourceCount)).toBe(0);
});

test('Media Session metadata and action handlers control the same audio', async ({page}) => {
  await page.addInitScript(()=>{
    window.mediaHandlers={};
    const set=navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
    navigator.mediaSession.setActionHandler=(action,handler)=>{window.mediaHandlers[action]=handler;set(action,handler);};
  });
  await boot(page,{playlist:tracks}); await start(page);
  expect(await page.evaluate(()=>navigator.mediaSession.metadata.title)).toBe('Daydream 1');
  await page.evaluate(()=>window.mediaHandlers.pause());
  expect((await audioState(page)).paused).toBe(true);
  await page.evaluate(()=>window.mediaHandlers.play());
  await expect.poll(async()=>(await audioState(page)).paused).toBe(false);
  await page.evaluate(()=>window.mediaHandlers.nexttrack());
  await expect(page.locator('#music-title')).toHaveText('Daydream 2');
  await expect.poll(async()=>(await audioState(page)).duration).toBeGreaterThan(0);
  await page.evaluate(()=>window.mediaHandlers.seekto({seekTime:2}));
  await expect.poll(async()=>(await audioState(page)).time).toBeGreaterThanOrEqual(2);
});

test('legacy entries, nested playlist, disabled music and unavailable preferences', async ({page}) => {
  const errors=await boot(page,{playlist:null,music:{playlist:[{title:'Nested',src:'__test/track0.wav'}],rememberPreferences:false,autoplay:true}});
  await expect(page.locator('#music-title')).toHaveText('Nested');
  expect((await audioState(page)).paused).toBe(true);
  await start(page);
  expect(await page.evaluate(()=>localStorage.getItem('chie.music.v1'))).toBeNull();
  expect(errors).toEqual([]);
});

test('disabled music leaves the remaining site functional', async ({page}) => {
  await boot(page,{playlist:tracks,music:{enabled:false}});
  await expect(page.locator('.music-widget')).toBeHidden();
  await expect(page.locator('#clockTime')).not.toHaveText('--:--');
  await expect(page.locator('#musicMini')).toBeHidden();
});

test('long playlist uses metadata only for the selected track and safe text rendering', async ({page}) => {
  let requests=0;
  page.on('request',req=>{if(req.url().includes('/__test/'))requests++;});
  const many=Array.from({length:1000},(_,i)=>({...tracks[0],id:`long-${i}`,title:i===0?'<img src=x onerror=alert(1)>':`Song ${i}`,src:`__test/long-${i}.wav`}));
  await boot(page,{playlist:many});
  expect(requests).toBe(0);
  await page.locator('.music-expand').click();
  await expect(page.locator('.queue-track')).toHaveCount(1000);
  await expect(page.locator('.queue-duration').first()).toHaveText('—:—');
  await expect(page.locator('#musicDialog h2')).toHaveText('<img src=x onerror=alert(1)>');
  expect(await page.locator('#musicDialog h2 img').count()).toBe(0);
  await page.locator('#musicDialog [data-music="play"]').click();
  await expect.poll(async()=>(await audioState(page)).time).toBeGreaterThan(0.05);
  expect(requests).toBe(1);
  await expect(page.locator('.queue-duration').first()).toHaveText('0:08');
  await expect(page.locator('.queue-duration').nth(999)).toHaveText('—:—');
});

test('mini player shares state, hides at mailbox and can be dismissed', async ({page}) => {
  await page.setViewportSize({width:390,height:700});
  await boot(page, {playlist:tracks}); await start(page);
  await page.locator('#home').scrollIntoViewIfNeeded();
  await expect(page.locator('#musicMini')).toBeVisible();
  await page.locator('#musicMini [data-music="play"]').click();
  expect((await audioState(page)).paused).toBe(true);
  await page.locator('#musicMini [data-music="next"]').click();
  await expect(page.locator('#music-title')).toHaveText('Daydream 2');
  await page.locator('#musicMini [data-music="expand"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#musicMini [data-music="expand"]')).toBeFocused();
  await page.locator('#letters').scrollIntoViewIfNeeded();
  await expect(page.locator('#musicMini')).toBeHidden();
  await page.locator('#home').scrollIntoViewIfNeeded();
  await expect(page.locator('#musicMini')).toBeVisible();
  await page.locator('[data-music="dismiss"]').click();
  await expect(page.locator('#musicMini')).toBeHidden();
});

test('minimize keeps playback running and opens a focused mini player beside the card', async ({page}) => {
  await boot(page,{playlist:tracks});
  await start(page);
  await page.locator('.music-expand').click();
  await page.locator('[data-music="minimize"]').click();
  await expect(page.locator('#musicDialog')).not.toBeVisible();
  await expect(page.locator('#musicMini')).toBeVisible();
  await expect(page.locator('#musicMini [data-music="expand"]')).toBeFocused();
  expect((await audioState(page)).paused).toBe(false);
  await page.locator('#musicMini [data-music="expand"]').click();
  await expect(page.locator('#musicDialog')).toBeVisible();
  await expect(page.locator('#musicMini')).toBeHidden();
  expect((await audioState(page)).paused).toBe(false);
});

test('native dialog keyboard focus, tab containment, Escape and focused Space/Enter', async ({page}) => {
  await boot(page, {playlist:tracks});
  await page.locator('.music-expand').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#musicDialog [data-music="close"]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement.closest('#musicDialog') !== null)).toBe(true);
  await page.locator('#musicDialog [data-music="play"]').focus(); await page.keyboard.press('Space');
  await expect.poll(async () => (await audioState(page)).paused).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('.music-expand')).toBeFocused();
  await page.locator('#letterText').fill('typing'); await page.keyboard.press('Space');
  await expect(page.locator('#letterText')).toHaveValue('typing ');
  expect((await audioState(page)).paused).toBe(false);
});

test('mailbox validation, 500 character limit, honeypot and invalid endpoint preserve draft', async ({page}) => {
  await boot(page, {anonymousFormEndpoint:'https://example.com/not-formspree'});
  await page.locator('#sendLetter').click();
  await expect(page.locator('#letterStatus')).toContainText('chưa viết');
  await page.locator('#letterText').fill('a'.repeat(500));
  await page.keyboard.type('b');
  expect((await page.locator('#letterText').inputValue()).length).toBe(500);
  await expect(page.locator('#letterCount')).toHaveText('500 / 500');
  await page.locator('#letterText').evaluate(t => {t.value='a'.repeat(501);});
  await page.locator('#sendLetter').click();
  await expect(page.locator('#letterStatus')).toContainText('vượt quá 500');
  await page.locator('#letterText').fill('hello');
  await page.locator('#honeypot').evaluate(t => {t.value='bot';});
  await page.locator('#sendLetter').click();
  await expect(page.locator('#letterStatus')).toContainText('Không thể');
  await page.locator('#honeypot').evaluate(t => {t.value='';});
  await page.locator('#sendLetter').click();
  await expect(page.locator('#letterStatus')).toContainText('chưa sẵn sàng');
  await expect(page.locator('#letterText')).toHaveValue('hello');
});

for (const scenario of ['network', 'rejection', 'unconfirmed', 'success']) {
  test(`mailbox ${scenario}: sending state, one POST, exact feedback and draft policy (mocked)`, async ({page}) => {
    let posts=0, release;
    const pending = new Promise(resolve => {release=resolve;});
    await page.route('https://formspree.io/f/testonly', async route => {
      posts++; expect(route.request().postDataJSON()).toMatchObject({message:'hello Chie',_gotcha:''});
      await pending;
      if(scenario==='network') return route.abort('failed');
      return route.fulfill({status:scenario==='rejection'?422:200,contentType:'application/json',body:JSON.stringify(scenario==='success'?{ok:true}:scenario==='unconfirmed'?{}:{errors:[{message:'rejected'}]})});
    });
    await boot(page,{anonymousFormEndpoint:'https://formspree.io/f/testonly'});
    await page.locator('#letterText').fill('hello Chie');
    await page.locator('#sendLetter').click();
    await expect(page.locator('#sendLetter')).toBeDisabled();
    await expect(page.locator('#letterForm')).toHaveAttribute('aria-busy','true');
    await page.locator('#letterForm').evaluate(f => { f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); });
    expect(posts).toBe(1);
    release();
    await expect(page.locator('#sendLetter')).toBeEnabled();
    await expect(page.locator('#letterText')).toHaveValue(scenario==='success'?'':'hello Chie');
    await expect(page.locator('#letterStatus')).toHaveText(scenario==='success'?'Thư của bạn đã được gửi đến Chie rồi! Cảm ơn bạn vì lời nhắn đáng yêu này ♡':'Thư chưa gửi được. Bạn thử lại một chút nữa nhé ✧');
  });
}

for (const width of [375,390,768,1024,1440]) {
  test(`responsive ${width}px: no horizontal overflow, controls reachable and screenshots`, async ({page}, testInfo) => {
    await page.setViewportSize({width,height:900});
    await boot(page,{playlist:tracks});
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.music-widget').scrollIntoViewIfNeeded();
    await page.screenshot({path:testInfo.outputPath(`card-${width}.png`)});
    await page.locator('.music-expand').click();
    expect(await page.locator('#musicDialog').evaluate(d => d.scrollWidth <= d.clientWidth)).toBe(true);
    await page.locator('#musicVolume').scrollIntoViewIfNeeded();
    await expect(page.locator('#musicVolume')).toBeInViewport();
    await page.locator('[data-track-index="2"]').click();
    await page.locator('#musicDialog').evaluate(d=>{d.scrollTop=0;});
    await page.screenshot({path:testInfo.outputPath(`player-${width}.png`)});
    await page.keyboard.press('Escape');
  });
}

test('unchanged sections retain baseline geometry', async ({page}) => {
  const selectors=['.hero','.clock-widget','.status-widget','.mood-widget','.social-facebook','.gallery-section','.letters-section'];
  await page.setViewportSize({width:1440,height:1000});
  await boot(page);
  await page.evaluate(()=>document.fonts.ready);
  const geometry=async()=>Promise.all(selectors.map(s=>page.locator(s).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})));
  const updated=await geometry();
  const baseline = execFileSync('git',['show','a8b2f08:index.html'],{encoding:'utf8'});
  await page.route('**/baseline',route=>route.fulfill({contentType:'text/html',body:baseline}));
  await page.goto('/baseline'); await page.evaluate(()=>document.fonts.ready);
  const before=await geometry();
  updated.forEach((r,i)=>Object.keys(r).forEach(k=>expect(Math.abs(r[k]-before[i][k]),`${selectors[i]} ${k}`).toBeLessThan(1)));
});
