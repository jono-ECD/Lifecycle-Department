# Deploying the Campaign Bank

Two paths. The simple one runs on one small box with SQLite and files on a volume. The proper one uses Postgres and S3 compatible storage and can run anywhere, including hosts with no persistent disk.

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
2. Point Prisma at the Postgres schema. Either copy it over the default, `cp prisma/schema.postgres.prisma prisma/schema.prisma`, or pass `--schema prisma/schema.postgres.prisma` to every Prisma command and set `prisma.schema` in `package.json`. The two files are identical except for the provider line; the models use only `String`, `Int`, `Boolean` and `DateTime`.
3. `npx prisma db push --skip-generate` (or `prisma migrate deploy` once you start keeping migrations), then `npm run seed` once.
4. Set `STORAGE_DRIVER=s3` and the `S3_*` variables. Uploads go straight to the bucket; the app serves URLs from `S3_PUBLIC_URL`.
5. Run as many instances as you like. Use an external cron for reminders (below) rather than `RUN_SCHEDULER`, so the job runs exactly once.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `file:/data/campaign-bank.db` or a Postgres URL |
| `SESSION_SECRET` | yes | 32 or more random characters. Changing it signs everyone out and invalidates email links |
| `APP_URL` | yes | Public https URL, no trailing slash. Used in reviewer links, emails and the in-process scheduler |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | seed | The first admin. Change the password after the first sign in by creating a new admin and removing the seeded one, or re-run the seed with a new password |
| `STORAGE_DRIVER` | yes | `local` or `s3` |
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
| `FIGMA_ACCESS_TOKEN` | optional | Agency Figma token. Without it the Figma link is kept but frames cannot be pulled |
| `NEXT_TELEMETRY_DISABLED` | optional | `1` |

## Running the seed

`npm run seed` pushes the schema, creates or updates the admin from env, replaces the Blessed Botanicals workspace with the prototype data, and prints the reviewer link. On a fresh production database run it once, then create the real reviewer link from `/admin/w/blessed-botanicals/settings` and revoke the seeded one.

## Setting the cron

The endpoint is `GET` or `POST /api/cron/reminders`. Authenticate with `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`. It sends reminders due today (at or after 9:00 workspace time, once per day per workspace), flushes review digests whose batch window has passed, and retries failed Slack, Asana and webhook deliveries. Safe to call as often as you like; nothing is sent twice.

Slack image previews need `APP_URL` to be a public https address, since Slack fetches the crop from the app. On localhost the crop link is still in the message text.

Run it hourly. Examples:

- Railway or Fly cron, GitHub Actions schedule, or any uptime pinger: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bank.example.com/api/cron/reminders`
- Vercel: add `{"crons": [{"path": "/api/cron/reminders", "schedule": "0 * * * *"}]}` to `vercel.json` and set `CRON_SECRET`; Vercel sends it as a bearer token. Vercel also needs path 2 (no disk).
- In process: `RUN_SCHEDULER=1` and no external cron, single instance only.

## Checklist before handing the link to a client

1. `APP_URL` is the https domain and the reviewer link starts with it.
2. `MAIL_FROM` domain is verified in Resend and a test email arrived.
3. `SESSION_SECRET` and `CRON_SECRET` are random.
4. The seeded reviewer link is revoked and the real one was created from the admin.
5. `npm run check` was green on the commit being deployed.
