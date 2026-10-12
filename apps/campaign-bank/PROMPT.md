# How to launch

1. Unzip `campaign-bank-handoff.zip` into an empty folder, for example `~/code/campaign-bank`.
2. Open a terminal in that folder and run:

```
claude --dangerously-skip-permissions
```

3. Paste the prompt below as the first message. Leave it running.

That flag removes every permission prompt for the session, so nothing blocks while you are away. The prompt itself tells Claude Code to stay inside this folder and never touch anything outside it.

If you prefer not to use the flag, run `claude`, type `/permissions`, and allow `Bash(*)`, `Edit(*)`, `Write(*)` for the project. Same effect, scoped to the folder.

---

# Prompt (paste everything below this line)

You are building the Campaign Bank for ECD Digital Strategy. Read `HANDOFF.md` in this folder first and treat it as the spec. Open `reference/bank_src.html` and read the JavaScript at the bottom; it is the behavior spec. Open `reference/prototype_gallery.jpg` and `reference/prototype_drawer.jpg` so you know what the result must look like.

Working rules for this session:

1. I am away for several hours. Do not ask me questions, do not stop to confirm, do not wait for input. Every choice not covered by HANDOFF.md is yours to make. Pick the option that is simplest to run and hardest to break, write it down in `DECISIONS.md` with one line of reasoning, and keep going.
2. Stay inside this folder. Never modify, read, or delete anything outside it. Never run commands that need credentials I did not give you. If something needs a real service (Resend, S3, Postgres), build the adapter, test it with a mock, and leave the env var documented.
3. Work in this order and do not skip ahead: scaffold and tooling, database schema and seed, storage adapter and uploads, auth for both roles, the reviewer bank page matching the prototype pixel for pixel in spirit, the drawer with every status transition, scheduling, admin screens, notifications, tests, README and DEPLOY.md, final polish pass.
4. Commit to git after each of those milestones with a clear message. Initialize the repo first if it does not exist.
5. Keep `PROGRESS.md` updated as you go: what is done, what is next, anything that failed and how you fixed it. I will read this first when I get back.
6. Verify with your own eyes. After the reviewer page and the drawer exist, run the app, take Playwright screenshots at 390px and 1280px, look at them, compare with the reference screenshots, and fix what does not match. Repeat this after scheduling and after admin screens. Save every screenshot to `e2e/screenshots/` with a descriptive name.
7. `npm run check` must be green before you consider yourself done. If a test is flaky, fix the cause, do not delete the test.
8. If you finish the definition of done in HANDOFF.md section 10 with time to spare, do these in order: an empty state illustration for a workspace with no campaigns, keyboard navigation in the drawer (Escape closes, arrows move between campaigns), a "copy reviewer link" button that also generates a QR code for the phone, and a small activity feed on the admin workspace page. Each one gets its own commit and its own PROGRESS.md line.
9. If you get stuck on one thing for more than 20 minutes, write what you tried in PROGRESS.md, choose a simpler approach, and move on. Do not loop.
10. Client-facing copy follows HANDOFF.md section 11. No dashes, no em dashes, no exclamation marks, short sentences. Reuse the prototype's copy wherever it exists.

When everything is done, end with a summary in `PROGRESS.md` under a heading "Summary for Mauricio": what works, how to start it, the seeded reviewer link, what you decided on your own, and what I should look at first. Then stop.

Begin now by reading HANDOFF.md.
