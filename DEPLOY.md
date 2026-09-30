# Deploying the Campaign Bank

Three paths. The simple one runs on one small box with SQLite and files on a volume. The proper one uses Postgres and S3 compatible storage and can run anywhere. The third is Netlify, which needs Postgres from elsewhere and keeps files in Netlify Blobs.

Whatever the host, `DATABASE_URL` decides the schema: a `postgres://` address uses `prisma/schema.postgres.prisma`, written from `schema.prisma` by `scripts/prisma-schema.mjs` on every Prisma command. Edit `schema.prisma` only.

## Path 1, simplest: Railway or Fly with a persistent volume

SQLite and local file storage on a mounted volume. One process, one volume, no other services.

1. Create the app from this repo. Build command `npm run build`, start command `npm start`. Node 20 or newer.
2. Mount a volume at `/data`.
3. Set the environment variables (list below) with `DATABASE_URL="file:/data/campaign-bank.db"` and `STORAGE_DIR="/data/storage"`.
4. First deploy: run the seed once from a shell on the box, `npm run seed`, or run `npx prisma db push --skip-generate` to create the schema and add the workspace by hand from `/admin` after signing in. The admin account is created by the seed only, so run the seed at least once, then delete the seeded workspace from the admin if you do not want the sample campaigns. Set `SEED_REVIEWER_TOKEN` to nothing or remove it so the seeded reviewer gets a random link.
5. Set `RUN_SCHEDULER=1` so reminders and review digests run inside the app every 15 minutes. No external cron needed.

Fly specifics: `fly volumes create data --size 1`, then in `fly.toml` add `[mounts] source = "data" destination = "/data"`. Keep `min_machines_running = 1` so the scheduler stays alive. Railway: add a volume from the service settings and mount it at `/data`.

Backups: copy the SQLite file and the storage folder. Both live on the volume.

## Path 2, proper: Postgres and S3

1. Provision Postgres and an S3 compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO). Make the bucket public read, or put a CDN in front and set `S3_PUBLIC_URL` to it.
2. Set `DATABASE_URL` to the Postgres address. Every `npm run` script picks the Postgres schema from it; nothing else to change.
3. `npm run db:push`, then `npm run seed` once, or `node scripts/bootstrap.mjs` to create only the admin without the sample workspace.
4. Set `STORAGE_DRIVER=s3` and the `S3_*` variables. Uploads go straight to the bucket; the app serves URLs from `S3_PUBLIC_URL`.
5. Run as many instances as you like. Use an external cron for reminders (below) rather than `RUN_SCHEDULER`, so the job runs exactly once.

## Path 3, Netlify: Postgres from Supabase, files in Netlify Blobs

Netlify has no disk and runs each page as a function, so the database must live elsewhere and files go to Netlify's own storage. The code handles both; the setup is four steps.

### 1. A Postgres database

Create a free project at supabase.com. In the project, click **Connect**, choose **Session pooler**, and copy the URI. It looks like `postgresql://postgres.xxxx:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres`. Put the database password in place of `PASSWORD`. This is `DATABASE_URL`. The session pooler works from Netlify; the direct connection often does not.

### 2. The site

In Netlify: **Add new project**, **Import an existing project**, pick the GitHub repository. Set **Base directory** to the folder that holds this app inside the repository. Leave the build command and publish directory alone; `netlify.toml` in this folder sets them.

### 3. Environment variables

Before the first deploy, add these under **Site configuration**, **Environment variables**. The build refuses to run with the values from `.env.example`, because that file is public.

| Variable | Value |
|---|---|
| `DATABASE_URL` | The Supabase session pooler URI from step 1 |
| `SESSION_SECRET` | 32 or more random characters |
| `CRON_SECRET` | 16 or more random characters |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | The first admin. The password must be 12 characters or more |
| `MAIL_FROM` | A sender on a domain verified in Resend |
| `RESEND_API_KEY` | From Resend. Without it no email goes out |
| `ASANA_ACCESS_TOKEN`, `FIGMA_ACCESS_TOKEN` | The agency tokens, from a general account |

Random strings, in PowerShell: `-join ((48..57)+(97..122) | Get-Random -Count 48 | % {[char]$_})`. On a Mac: `openssl rand -hex 24`.

`APP_URL` is optional here, Netlify supplies the site address. Set it once a custom domain is in place. `STORAGE_DRIVER` is optional too, Netlify Blobs is the default on Netlify.

### 4. Deploy

Click **Deploy**. The build checks the settings, creates the tables, creates the admin, and builds the app. Then sign in at `/admin/login`, add the first workspace, and enter that client's connections. Reminders, Asana pulls and Klaviyo refreshes run every five minutes from `netlify/functions/cron.mjs`; no cron to set up.

### Limits that shaped the code

- A request to a Netlify function carries about 4.5 MB. Files bigger than 3.5 MB go up in parts of 3 MB and are put back together on the server, so the 15 MB image and 25 MB PDF limits still hold. See `lib/uploadParts.ts`.
- A function runs for 60 seconds at most. Importing many large frames from Figma in one go may hit it; import a few at a time if it does.
- Files are served through the app, cached for a year at the edge. Netlify's own storage is used, so no bucket and no keys are needed.

### Not verified yet

Everything above is written from Netlify's documentation and tested against stand ins. The first deploy is the first real run. Expect a small fix or two, and send the build log if it fails.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `file:/data/campaign-bank.db` or a Postgres URL |
| `SESSION_SECRET` | yes | 32 or more random characters. Changing it signs everyone out and invalidates email links |
| `APP_URL` | yes | Public https URL, no trailing slash. Used in reviewer links, emails and the in-process scheduler |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | seed | The first admin. Change the password after the first sign in by creating a new admin and removing the seeded one, or re-run the seed with a new password |
| `STORAGE_DRIVER` | yes | `local`, `s3` or `netlify`. On Netlify it defaults to `netlify` |
| `STORAGE_DIR` | local | Folder on the volume |
| `S3_BUCKET`, `S3_REGION` | s3 | Bucket and region |
| `S3_ENDPOINT` | s3, optional | For R2, B2, MinIO. Path style is used when set |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | s3 | Or rely on the instance role when unset |
| `S3_PUBLIC_URL` | s3, optional | Public base URL for objects, defaults to the bucket's AWS URL |
| `RESEND_API_KEY` | production | Without it emails print to the console |
| `MAIL_FROM` | yes | A sender on a domain verified in Resend |
| `CRON_SECRET` | yes | Random string for the cron endpoint |
| `RUN_SCHEDULER` | path 1 | `1` to run reminders in process |
| `REVIEW_BATCH_MS` | optional | Default 600000 |
| `SEED_REVIEWER_TOKEN` | never in production | Leave unset so the seed makes a random link |
| `ASANA_ACCESS_TOKEN` | optional | Agency Asana token. Without it Asana connections show "Token missing" and nothing is sent |
| `FIGMA_ACCESS_TOKEN` | optional | Agency Figma token. Without it Import from Figma explains how to add it and frames cannot be pulled |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | optional | The whole service account key as one line. Share the Scheduler sheet with its email as an editor. Without it, use the feed link |
| `ENABLE_DEV_MOCKS`, `FIGMA_API_BASE`, `KLAVIYO_API_BASE`, `ASANA_API_BASE` | never in production | Sample mode for local trials. Leave all unset |

Klaviyo keys and spreadsheet links are per client and are entered in the admin under Connections, not in the environment. Klaviyo keys are encrypted with a key derived from `SESSION_SECRET`, so changing that secret means entering the client keys again.
| `NEXT_TELEMETRY_DISABLED` | optional | `1` |

## Running the seed

`npm run seed` pushes the schema, creates or updates the admin from env, replaces the Blessed Botanicals workspace with the prototype data, and prints the reviewer link. On a fresh production database run it once, then create the real reviewer link from `/admin/w/blessed-botanicals/settings` and revoke the seeded one.

## Setting the cron

The endpoint is `GET` or `POST /api/cron/reminders`. Authenticate with `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`. It pulls Asana (every five minutes at most), checks Figma files for changes, reads the content calendar, refreshes Klaviyo, sends reminders due today (at or after 9:00 workspace time, once per day per workspace), flushes review digests whose batch window has passed, and retries failed Slack, Asana and webhook deliveries. Safe to call as often as you like; nothing is sent twice.

Slack image previews need `APP_URL` to be a public https address, since Slack fetches the crop from the app. On localhost the crop link is still in the message text.

Run it every five minutes, which is the Asana polling interval. Each job inside keeps its own pace, so nothing runs more often than it should. Examples:

- Railway or Fly cron, GitHub Actions schedule, or any uptime pinger: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bank.example.com/api/cron/reminders`
- Vercel: add `{"crons": [{"path": "/api/cron/reminders", "schedule": "0 * * * *"}]}` to `vercel.json` and set `CRON_SECRET`; Vercel sends it as a bearer token. Vercel also needs path 2 (no disk).
- In process: `RUN_SCHEDULER=1` and no external cron, single instance only.

## Checklist before handing the link to a client

1. `APP_URL` is the https domain and the reviewer link starts with it.
2. `MAIL_FROM` domain is verified in Resend and a test email arrived.
3. `SESSION_SECRET` and `CRON_SECRET` are random.
4. The seeded reviewer link is revoked and the real one was created from the admin.
5. `npm run check` was green on the commit being deployed.
6. The Asana and Figma tokens belong to a general ECD account, not to a person. Any personal token used during setup was revoked in Asana or Figma.

## Upgrading an existing database

`npm run db:push` adds the new columns and tables and keeps the data. Then run `node scripts/backfill-approvals.mjs` once: campaigns approved before approvals were tied to a version get their record from the thread.

## Using Supabase

The architecture plan names Supabase. It fits without code changes: use the Supabase Postgres connection string as `DATABASE_URL` with `prisma/schema.postgres.prisma`, and Supabase Storage through its S3 compatible endpoint with `STORAGE_DRIVER=s3`. Tenant isolation is enforced by the application and covered by a second tenant test; row level security policies can be added on top later.
