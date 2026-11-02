# Private mailbox audit

Audited 2026-11-02 against fetched `origin/main` at `1e807ab`. The clean local main matched upstream (0 ahead, 0 behind). Work branch: `feature/chie-private-mailbox-dashboard`.

## Verified repository facts

- Vanilla HTML/CSS/JS, no application framework, backend, authentication, database or admin interface.
- `config.js` is publicly downloaded. Its old endpoint was `mkyqpqdv`; owner supplied replacement `mzeekake`.
- `script.js` sends JSON containing `message`, `_gotcha`, `source` directly to the configured provider. It validates 500 characters, disables duplicate sends, aborts after 15 seconds, retains drafts on failure, and clears only on explicit provider success.
- Existing UI tokens: ink #254c60, accent #54aab7, light blue #d8f2f5, mint #dcf5ef, white translucent surfaces, rounded corners, Nunito/DM Sans. Admin reuses this palette without changing public CSS.
- Hero, cosplay lightbox, social links, background assets and independent `music.js` engine must remain unchanged.
- Render currently publishes the entire repository (`staticPublishPath: .`) without a build. Adding backend files here would expose source and example configuration. Replace publication with an explicit public-file allowlist.
- Playwright tests exercise gallery, mailbox validation/provider errors, responsive behavior, real native audio decoding, playback modes and accessibility. `tests/serve.py` serves public tests on 8001. Optional MP3 test needs an FFmpeg-generated fixture.
- Existing `tests/test_letter_api.py` sends a REAL letter by default; use `--dry-run` for non-delivery preflight.
- Recent history includes playlist/API testing (`1e807ab`), multi-provider support (`ee24a45`), and earlier music player work. No infrastructure can be inferred from these commits.

## Architecture decision

Keep public POSTs to Formspree unchanged except the owner-provided endpoint. Separate same-origin Express admin service, PostgreSQL for admin credentials, sessions, imported messages, metadata and sync cursor. API mode uses ONLY the documented read endpoint with a server-side read-only key. Explicit authenticated refresh imports batches, never sends letters. No unverified provider mutations or webhooks.

Default `INBOX_MODE=disabled`: authentication works, inbox reports setup required and contains no generated messages. Optional development fixtures exist only in tests, injected through the repository boundary. Account plan/API permissions and real delivery are unverified; enabling API mode requires owner setup and the E2E procedure.

## Risks and mitigations

- Static origin must never serve server/admin files: explicit `dist` allowlist; admin service serves only individual assets, authenticated HTML and APIs.
- Private provider key stays on backend; no browser persistence for messages/tokens. Passwords Argon2id, sessions PostgreSQL, HttpOnly/Secure/SameSite cookies, origin + session CSRF token, session regeneration and logout invalidation.
- Login throttles use PostgreSQL so counters survive restarts; one Render instance with trusted proxy configuration. Generic auth errors avoid enumeration.
- Provider sample does not document a stable submission ID. Import identity fingerprints form/date/message; exact duplicates at an identical timestamp cannot be distinguished. Retain deletion tombstones to prevent re-import. This limitation must be reviewed if the message schema changes.
- Local deletion removes synchronized content, retaining only its fingerprint/timestamps. It never deletes the Formspree original. Archives/favorites/read flags are local persistent metadata. Formspree retention still depends on the owner's plan.
- Offset pagination can shift if provider history is edited during import. Rescanning is idempotent; no snapshot or exact-once claim. Import is bounded per refresh and exposes continuation.
- Production startup requires database, strong session secret, HTTPS admin origin and migrations. No automatic production deploy, merge, real messages, or account changes are authorized by implementation alone.
