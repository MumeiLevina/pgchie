# Verification record — 2026-10-31 (Asia/Saigon)

## Follow-up: local music and minimize button

Added the five owner-supplied MP3 paths to `config.js` and a “−” button beside the
expanded player's close button. Minimizing shows the shared mini controller even
when the dashboard card is visible, preserves playback and moves keyboard focus
to the mini player's expand control. The mini player still hides near the mailbox.

`npm test`: **29 passed, 0 failed, 0 skipped in 21.6 seconds** in Microsoft Edge.
An additional browser smoke check used the actual local MP3s without intercepted
audio requests: all five decoded, reported duration and advanced playback time;
minimizing preserved playback; no page errors occurred. Durations were approximately
214.47s, 173.79s, 336.82s, 188.40s and 148.95s in playlist order.
This supersedes the initial report's “owner music unverified” limitation for local
decoding/playback only. Physical speaker listening and public hosting remain unverified.
The supplied MP3 files remain local and untracked; only source/configuration changes
are included in the follow-up commit.

## Audit and scope

The starting checkout was clean on `main`, at `a8b2f08` (ocean background brightness).
Earlier commits were `a0729ee` (mailbox setup notice) and `5112201` (root static site).
Remote: `https://github.com/MumeiLevina/pgchie.git`. No unrelated changes were present.
Work was performed on `feature/chie-premium-music-player`.

Read the root HTML, CSS, JavaScript, configuration, README and asset inventory before editing.
The old music controls were bound directly in `script.js`; the mailbox already had basic
validation and fetch but hid unconfigured-endpoint feedback. Existing typography, hero,
GIFs, profile, gallery, social cards and their styles remain intact. The ignored nested
backup directory was not edited.

## Commands and outcomes

| Command / check | Result |
| --- | --- |
| `git status --short`, `git branch --show-current`, `git log -5 --oneline`, `git remote -v`, `git ls-files` | Clean starting tree; correct repository and baseline identified |
| `rg --files`, `rg -n` and UTF-8 reads of root files/assets | Vanilla static site; no existing package/test framework or recorded audio |
| `git switch -c feature/chie-premium-music-player` | Feature branch created |
| `node --version`, `python --version` | Node v24.21.0; Python 3.14.7 |
| `gh --version` | GitHub CLI not installed; use connected GitHub tools for PR/status |
| `npm install` | Three development packages installed; no runtime dependencies; zero audit findings |
| `python -m http.server 8000 --bind 127.0.0.1` | Initial local visual smoke server; later replaced in the test harness with `python tests/serve.py` on port 8001 for a larger connection queue |
| `python -m pip install --quiet imageio-ffmpeg` | Test-only audio encoder installed outside the project |
| `python tests/generate-tone.py` | Genuine sine-signal WAV/MP3 encoded in OS temp directory; no audio file added to repository |
| Initial `npm test` (23 cases) | 15 passed / 8 failed: server connection refusals, mock audio missing range responses, and card height regression; all corrected |
| Second `npm test` (23 cases) | 23 passed in 18.3 seconds |
| Expanded `npm test` (28 cases) | 27 passed / 1 failed: browser requested the selected audio despite `preload=none`; corrected by assigning `src` only when playback is requested |
| Final `npm test` (28 cases) | **28 passed, 0 failed, 0 skipped in 22.9 seconds** in headless Microsoft Edge on Windows |
| `node --check music.js`, `node --check script.js`, `node --check config.js` | All pass |
| `git diff --check` | Pass; Git reports local newline normalization notices, no whitespace errors |
| `npm audit --omit=dev` | Zero vulnerabilities; no production npm dependencies |
| `python -m pip install --quiet pyyaml jsonschema` followed by `jsonschema.validate(yaml.safe_load(open('render.yaml')), schema)` | Pass against `https://render.com/schema/render.yaml.json` fetched live |
| `git ls-remote --heads origin main feature/chie-premium-music-player` | Remote main matched the audited baseline; target feature branch did not already exist |
| `git ls-remote` for official `actions/checkout`, `actions/setup-node`, `actions/setup-python` v7 tags | Confirmed exact revisions pinned in the browser CI workflow |

Render configuration was checked against the current [Static Sites docs](https://render.com/docs/static-sites)
and [Blueprint reference](https://render.com/docs/blueprint-spec). The validation above is a schema check,
not a live Render deployment or API Blueprint creation.

## Browser coverage

All automated audio tests use native browser decoding/playback. Audio events and analyser data
are not fabricated. Test signals are synthetic tones, not music recordings. Requests for those
signals are intercepted with byte-range support to behave like real static audio delivery.

- Empty, single, multiple and 1,000-track playlists; missing audio/cover fallbacks.
- MP3 and WAV decoding, play/pause, seeking, volume, mute/unmute, previous/next and song selection.
- Actual end-of-track transitions, repeat all/one/off, shuffle without repeats within a cycle,
  history, rapid consecutive commands and synchronized controls with exactly one audio element.
- Stored volume/modes/selected track, no sound on reload, unavailable localStorage,
  legacy/nested configuration, disabled music and deliberate no-autoplay behavior.
- Real nonzero FFT data from `AnalyserNode`, exactly one media source across track changes
  and dialog reopenings, no analysis frames while paused/closed/hidden or in reduced motion.
  Hidden-page state is simulated for the corresponding lifecycle assertion.
- Native playback without AudioContext; mixed local/remote sources bypass Web Audio to avoid CORS muting.
- Media Session metadata and registered action handlers, using the same native audio element.
- Mini player pause/next/expand/dismiss, focus return and automatic hiding at the mailbox.
- Native dialog keyboard activation, Tab containment, Escape, focus restoration,
  visible focus styling and typing spaces in the mailbox without changing playback.
- Responsive layouts at **375, 390, 768, 1024 and 1440 px**, with no horizontal overflow
  and all controls reachable by scrolling. Safe-area/dynamic viewport CSS is present.
- Hero/mood images and GIF load, clock ticks, inert unconfigured social cards,
  Discord unconfigured state and gallery opening/closing.
- Geometry comparison against the original HTML at `a8b2f08`: hero, clock, profile,
  mood, social card, gallery and mailbox match within one CSS pixel at 1440 px.
- Track metadata uses safe text rendering; metadata is requested only for the played track.

Desktop and mobile screenshots were visually inspected, including the compact card,
empty expanded player and playing expanded player. Automated interaction screenshots
stub Google Fonts CSS for deterministic layout; an initial visual smoke check used the
actual site fonts. Screenshot artifacts are under ignored `test-results/`.

## Mailbox coverage and limits

Passed: empty/whitespace validation, 500-character browser and JavaScript enforcement,
counter, honeypot, unconfigured/invalid endpoint, busy state, duplicate submission guard,
network failure, HTTP rejection, unconfirmed success body, exact Vietnamese feedback,
draft preservation on failure and clearing only after `{ok:true}`.

Formspree responses were **mocked**, with no messages sent to a real account. The configured
endpoint is intentionally blank. Real submission, CAPTCHA interactions, spam/domain
settings and arrival in the private Formspree dashboard remain owner checks.

Not executed: physical speaker listening, real owner music/cover assets, physical
iOS/Android browser toolbar/safe-area behavior, Safari/Firefox, actual system lock-screen
or Bluetooth controls, configured live Lanyard presence, real Formspree delivery,
Render deployment and production HTTPS verification. Native media/system capabilities
depend on the browser; no unsupported-device guarantees are made.

## Release and owner checks

The feature is prepared for review through a PR into `main`. CI configuration runs browser
checks on pull requests using Chromium on Linux. Consult the PR checks for actual remote
run status; local success does not establish remote CI success.

Production merge and deployment require explicit owner authorization. No Render URL or
HTTPS deployment is claimed. Add licensed audio under `assets/music/`, assign `src` and
optional `cover` paths in `config.js`, and provide a real `anonymousFormEndpoint` before
performing the live checks above. Follow the README Render instructions after review.
