# Protected schedule publishing

Schedule studio keeps editing local and sharing explicit. Every published learner link requires its own password. There is no public-link setting.

## Using it

1. Open a local learner plan and choose **Publish**. Unlock publishing with the site owner's publisher passphrase.
2. Select the days to share, expand their item summaries, and enter a learner password of 8–128 characters. Optionally choose when the link expires.
3. Choose **Publish learner link**. Copy the link and share its password separately. The learner opens `/schedules/p/<random-id>` and enters that password.
4. Continue editing the local draft. Choose **Publish updated plan** when those changes are ready. The learner link stays the same.

Ghost items, hidden or unchecked days, disabled suggestion candidates, unrelated pictures, reusable libraries, other learner plans and Plan Trash are excluded. Scheduled steps, choices, videos, suggestion rules, uploaded visuals and symbol credits are preserved. The server checks the snapshot independently, rejecting overlapping or out-of-session items, missing pictures and suggestions that cannot fit their time block.

**Password and expiry** changes access without changing the content. A new learner password invalidates previously unlocked sessions. **Withdraw learner link** stops learner access and keeps saved versions available to the publisher. **Published versions** previews and republishes one of the last ten content snapshots on the same link, using the current password and expiry. Restoring published content leaves the local draft unchanged. For an expired link, clear or extend its expiry before restoring a version.

**Published plans** in the planner library provides access on another device. After unlocking publishing, choose a plan and **Make an editable local copy**. Its draft keeps the link association, so Publish updates that link. Editing stays local until republished. Duplicating a local plan creates an independent draft with its own future publication. Moving a local plan to Trash does not withdraw its published link; use Withdraw explicitly.

Learners can use **Lock schedule** to end their session on that browser. Learner sessions last up to 12 hours; publisher sessions last up to 8 hours. These are separate gates, so locking publisher access does not lock learners. Checks, choices and suggestion draw budgets remain local to the learner device and calendar day. Published content is held in memory rather than saved into the learner's plan library. The page rechecks access every 30 seconds while visible and when it returns to the foreground; it clears content if access is revoked or the connection fails. An already displayed page updates on its next check.

## Production setup

The framework uses the site's existing Vercel Edge Functions and Neon database. It does not use the unauthenticated `/api/public` endpoint.

1. Apply `api/schema.sql` to the intended Neon database. Its `CREATE TABLE/INDEX IF NOT EXISTS` statements add `schedule_publications`, `schedule_revisions`, `schedule_sessions` and `schedule_attempts` alongside the existing tables.
2. Configure `DATABASE_URL` on Vercel. Set `SCHEDULE_PUBLISHER_PASS_HASH` to the hexadecimal SHA-256 hash of a long, randomly generated publisher passphrase. If this variable is absent, the existing `SYNC_PASS_HASH` is used. Give the publisher the actual passphrase, never the hash. `.env.example` documents the variables and existing local hash-generation command.
3. Deploy the source, including `api/schedules.ts`, its helper modules, planner/view assets and the `/schedules/p/:path*` rewrite. HTTPS enables Secure session cookies. This feature needs the API and database; a static file server alone cannot publish.
4. Verify a non-sensitive sample: owner login, initial publish, learner unlock in a separate browser, republish, password change, expiry and withdrawal. Confirm a request without a learner session returns no learner labels or content. The initial implementation has not applied a production migration or deployed these changes.

The publisher gate is the site's existing single-owner passphrase model, with an optional separate schedule credential. It is not a multi-user account system. Local drafts are stored in the trusted editor browser; the password layer protects cloud management and learner links. Resetting a forgotten learner password requires publisher access. Resetting a forgotten publisher passphrase requires changing its configured server hash and redeploying; that change invalidates schedule sessions.

## Security and data boundaries

- Learner passwords use unique random salts and PBKDF2-HMAC-SHA256 with 600,000 iterations. This follows the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Only hashes are stored.
- Session tokens contain 256 random bits. The database stores their hashes, scope, access version, publisher-key version and expiry. Cookies are HttpOnly, SameSite=Strict, Secure on HTTPS, and scoped to `/api/schedules`.
- Every mutation requires JSON and a matching Origin. Management reads require a publisher session; learner reads require a session for that exact publication. Protected responses use `Cache-Control: no-store`. Passwords and payloads are not placed in URLs or local publishing metadata.
- Each publication has a 128-bit random address. There is no learner-facing catalogue. Durable counters limit unlock attempts to ten per IP/scope per 15-minute window, with a further scope-wide cap. Counters and expired sessions are cleaned during unlock attempts.
- Publishing uses optimistic versions. A competing update returns HTTP 409. A unique source-plan index also prevents competing first publications from creating duplicate links. Content and revision history commit atomically in one SQL statement. History cleanup happens after that commit and cannot turn a successful publication into a failed response.
- Neon contains protected snapshots and revisions, including referenced inline images, password hashes, session records, attempt counters and source-plan identifiers. Withdrawal retains publisher content and history; permanent cloud deletion is not offered in this version.
- Snapshot size is capped at 3.5 million UTF-8 bytes, with a 3.75 million byte request cap. Reduce uploaded pictures if a plan exceeds that allowance. Catalogue and history queries fetch summaries rather than all stored pictures.
- External pictogram and video URLs continue to work as external resources. Password protection applies to the schedule payload and uploaded images, not to independently hosted external resources.

## Verification

`pnpm exec vitest run` covers the API gates, password hashing, session isolation, CSRF rejection, conflict protection, access rotation, expiry, withdrawal, conditional reads, private-content filtering and revision retention. `pnpm exec playwright test schedule-` covers the existing schedule features plus publishing, separate learner browsers, editable copies, version restore, mobile rendering and accessibility. API and E2E TypeScript projects have separate checks.

The local integration server runs the production API handler and Web Crypto password/session code, injecting an in-memory implementation at the SQL boundary. The fixture tests browser-to-handler behavior without contacting Neon. They do not establish that the live database migration or production deployment is configured correctly.
