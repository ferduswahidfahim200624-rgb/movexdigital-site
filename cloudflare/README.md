# Private forms inbox (Cloudflare Workers + D1)

This adds a private database-backed inbox without Supabase. GitHub Pages remains the public static host; the Worker accepts form submissions and D1 stores them. The public pages contain no database credentials or admin passwords.

## What it provides

- Saves contact enquiries (name, email, requested service, project note, source page, received time, follow-up status).
- Saves newsletter emails only after an explicit opt-in, with the source page and consent time.
- Serves `/admin/` as a noindex admin screen; records are returned only after an authenticated API login.
- Supports several admin accounts via a Cloudflare secret, lead status updates, search, and CSV export.
- Validates inputs, restricts browser origins, uses a hidden honeypot, throttles repeat submissions, and rate-limits admin sign-in attempts.

## One-time Cloudflare setup

Run these commands from this `cloudflare/` folder with Node.js/npm installed. Wrangler will ask you to sign in to your own Cloudflare account; do not send passwords, API tokens, or admin passwords in chat or commit them to Git.

1. Install Wrangler for this folder if needed: `npm install --save-dev wrangler`.
2. Create the private database: `npx wrangler d1 create movexdigital-inbox`. Copy the returned database ID.
3. Copy `wrangler.toml.example` to `wrangler.toml` and replace `REPLACE_WITH_ID_FROM_WRANGLER_D1_CREATE` with that ID. `wrangler.toml` is ignored by Git.
4. Apply the schema: `npx wrangler d1 migrations apply movexdigital-inbox --remote`.
5. Add one or more admin email/password pairs as a Cloudflare secret. Run `npx wrangler secret put ADMIN_USERS_JSON` and paste JSON such as `[ {"email":"you@example.com","password":"a-long-unique-password"} ]`. Add additional objects for additional admins. Use unique strong passwords.
6. Create a random signing secret (PowerShell): `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`. Run `npx wrangler secret put ADMIN_JWT_SECRET` and paste that generated value.
7. Deploy the API: `npx wrangler deploy --config wrangler.toml`. Copy the `workers.dev` URL shown by Wrangler.
8. Put that URL in `assets/movex-inbox-config.js` as `window.MOVEX_INBOX_API = 'https://YOUR-WORKER.YOUR-ACCOUNT.workers.dev';` and publish the GitHub Pages site.

`ALLOWED_ORIGINS` already lists the production domain, GitHub Pages preview, and apex domain. If the site URL changes, update that value and redeploy the Worker. Keep the API URL public; it is not a secret. Passwords and signing keys must remain Cloudflare secrets. To change an admin password, update `ADMIN_USERS_JSON`; rotating `ADMIN_JWT_SECRET` signs out all existing sessions.

## Admin use

Open `https://www.movexdigital.site/admin/`, sign in with one of the configured admin accounts, then use the Lead enquiries and Newsletter subscribers tables. Lead statuses and CSV exports are handled by the protected API. `noindex` only asks search engines not to index the admin screen; the actual privacy boundary is API authentication.

## Privacy and limits

The inbox stores personally identifying contact details. Limit admin access to trusted staff, use a unique password per admin, and handle deletion/unsubscribe requests at the agency email. Never put customer records in this public Git repository. Current forms will show an email contact fallback until `MOVEX_INBOX_API` is configured and the Worker is deployed; they do not claim success when the API is unavailable.

D1 is queried only by the Worker binding. The admin client never connects directly to D1. The database ID is configuration, not a credential; the Worker secrets are the credentials.
