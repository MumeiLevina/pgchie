# Chie private mailbox setup

The public site still sends directly to `https://formspree.io/f/mzeekake`. The admin is a **separate service and origin**. Open that service's `/admin/`, not the public static site's `/admin/`. There is no shared public CORS API and no secret in `config.js`.

## Current release status

Implementation and automated fixtures are reviewable; production has NOT been changed. Account plan, real API credentials, provider history and real end-to-end delivery are NOT VERIFIED. CORS preflight for the new public endpoint passed, which is not proof of delivery. Do not label the integration live until the owner completes the E2E checklist below.

## Local setup with real PostgreSQL

1. Use Node 24+, Python for public browser tests, and PostgreSQL. Create a dedicated empty development database. Do not point tests at production.
2. Run `npm ci` from repository root. Copy `.env.example` to `.env` and replace `DATABASE_URL` and `SESSION_SECRET`. Generate the latter privately with the command in the example; never use the placeholder.
3. Run `npm run migrate --workspace server`. Migrations are transactional, versioned and repeatable. Future schema changes require a new migration version; do not edit version 1 after deployment.
4. Run `npm run provision --workspace server` in an interactive trusted terminal. Enter the admin email and a unique password of at least 14 characters. The password input is hidden; only its Argon2id hash is stored. Re-running this command rotates the single admin credential and invalidates every session. There is no public signup or password-reset route.
5. Run `npm run start:admin`, open `http://127.0.0.1:8002/login`, and sign in. Default mode shows setup required, not fabricated submissions.
6. Public preview: `npm run build:public`, then `python -m http.server 8000 --directory dist`. Do not publish the repository root or serve backend files from a public web server.

## Enable verified Formspree API mode

1. In the owner Formspree account, open form `mzeekake`. Confirm HTTP API access is included in the selected plan; [official API documentation](https://help.formspree.io/articles/the-forms-api/form-submissions-api) currently specifies Professional/Business. The endpoint itself does not prove this permission.
2. Under form Settings, enable HTTP API and obtain the **read-only API key**. Keep it private even if the provider names it a public key. Do not give this dashboard a master key.
3. In backend environment variables, set `INBOX_MODE=api`, `FORMSPREE_FORM_ID=mzeekake`, `FORMSPREE_API_TOKEN=<read-only key>`. Put the token only into Render's secret environment UI or your ignored local `.env`; never into chat, browser JS, Git, CLI arguments, screenshots or public files.
4. Restart the backend and log in. Click **Đồng bộ thư**. Each request fetches at most 100 submissions using the documented GET route, imports transactionally and saves a continuation cursor. Continue until the UI reports completion. No automatic background polling occurs; click again to rescan for later submissions. Existing local metadata and deletion tombstones survive rescans.
5. Missing key fails closed. 401/403 from provider produces a generic access error, 429 suggests waiting, and failed/malformed pages do not advance the cursor. Review the [capability report](formspree-capability-report.md) for limits.

The dashboard does not expose a webhook endpoint. Signature/retry tests are not applicable to this selected API architecture. Never configure an unsigned guessed webhook URL to bypass plan limitations. If HTTP API is unavailable, keep mode disabled and use the owner's Formspree inbox. A future signed-webhook implementation or explicit export importer requires separate work.

## Render deployment — owner actions after PR review

No deployment, Blueprint sync, production settings change or merge has been performed. The Blueprint defines paid resources, so review the plan selection before creating them.

1. Review and merge the PR only when ready. Review any existing Render service settings before applying the Blueprint; do not assume YAML has changed an already running service.
2. Preserve the existing static site. Its reviewed build command must be `node scripts/build-public.js`, publish directory `dist`. Keep `SKIP_INSTALL_DEPS=true`. This publishes only public HTML/CSS/JS/assets. Do not use the old `.` publication directory once private source is in the repo. Source contains no credentials, but should not be served.
3. Create the separate `chie-private-mailbox` Node service and `chie-mailbox-db` PostgreSQL in the same region/private network. Blueprint uses one backend instance, internal DB URL and no external DB IP access. Select a durable paid database and configure backups.
4. Set `ADMIN_ORIGIN` to the exact HTTPS admin origin (no trailing slash), e.g. the actual `https://<admin-service>.onrender.com`; retain generated `SESSION_SECRET`, `NODE_ENV=production`, and initially `INBOX_MODE=disabled`. A missing origin/DB/secret blocks startup. The app trusts exactly one Render reverse proxy and uses Secure, HttpOnly, SameSite=Strict host-only cookies.
5. Backend build: `npm ci --omit=dev`; start: `npm run start:admin`. Startup runs versioned migrations before binding the port. Health check: `/healthz`. Both proposed services have automatic deployment disabled.
6. In the backend's trusted Render shell run `npm run provision --workspace server`. Use a unique admin password. Visit `/login` over HTTPS and check unauthorized requests cannot access `/api/messages`.
7. If the account supports API access, set the provider variables above and manually redeploy/restart the backend. No `PUBLIC_SITE_ORIGIN`, cross-origin credentials, webhook secret, or admin email/password environment variable is needed.
8. Verify public music/gallery/form behavior and perform E2E below. Keep provider and DB backups/retention aligned with your privacy expectations.

See [Render Blueprint reference](https://render.com/docs/blueprint-spec) and [Node version configuration](https://render.com/docs/node-version).

## Exact manual E2E procedure (not run automatically)

1. Open deployed public site and submit **one** unique, innocuous, clearly labeled `[OWNER E2E TEST <timestamp>]` message under 500 characters. This deliberately sends a real notification and consumes provider quota.
2. Verify the original appears in the owner's Formspree dashboard for `mzeekake`.
3. Log into the private backend dashboard. Import all pending pages and find the exact marker by search; verify full content and received time. Only then record real delivery as verified.
4. Mark unread/read, favorite/unfavorite, archive/unarchive. Restart the backend and verify state remains. Log out; replaying the old session must not authorize inbox requests. Also test expiry and cookie flags on deployed HTTPS.
5. Delete the local test copy with confirmation. Rescan all pages: it must stay deleted locally. Confirm the original still exists on Formspree, then remove the provider original manually if desired.
6. Record date, environment, provider/API result and restart behavior in a private release record. Never commit private content, keys, cookies or exports.

## Data, retention and operational limitations

- Imported content persists in PostgreSQL until explicitly deleted; no automatic age-based purge. Backups retain content according to your backup policy. Local deletion blanks content/favorite status and retains fingerprint/received/sync/deletion timestamps to block re-import. Provider retention is independent.
- Read/unread, favorites and archives are local metadata. No provider mutation endpoint is called.
- Provider docs do not promise a stable ID: fingerprint is form ID + exact date string + message. Identical letters at an identical timestamp collapse to one entry. Changed date serialization can create another fingerprint. Do not claim exactly-once import.
- Offset pagination has no documented snapshot. Avoid editing provider history during import; a subsequent full rescan can fill gaps. Refresh is one page; large inboxes need multiple clicks. Completion resets cursor to zero. Failed pages do not advance cursor; a lost browser response after commit is safe to retry.
- Search is literal, case-insensitive, limited to 200 characters, with indexed received ordering. It scans retained content; add a text-search index if usage grows. Pages contain 20 entries.
- Sessions expire absolutely after four hours. Database-backed login limit: five attempts/IP/15 minutes (successes count). Sync limit: ten/minute. Short-lived CSRF bootstrap flood protection is in-process; it is not the credential brute-force control.
- App never logs passwords, tokens, content, search terms or provider response bodies. Infrastructure access logs may record URLs; review Render access-log settings if search terms must be excluded there.
- Use a dedicated admin origin without untrusted apps. Rotate an exposed provider key in Formspree. Rotate session secret to invalidate cookies; use provision to rotate admin credentials.
