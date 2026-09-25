# Decisions

Choices that HANDOFF.md did not make. One line of reasoning each.

1. Plain CSS instead of Tailwind. The prototype CSS is ported verbatim and is the source of truth, so a utility framework would only add a second way to say the same thing.
2. Playwright browsers install into `node_modules/playwright-core/.local-browsers` (`PLAYWRIGHT_BROWSERS_PATH=0`, set by `scripts/pw.mjs`). Keeps every write inside this folder.
3. npm cache lives in `./.npm-cache` (already set in `.npmrc` by the previous attempt). Same reason.
4. TypeScript pinned to 5.9. Next 15.5 and typescript-eslint do not support 6.0 yet.
5. `npm run seed` and `npm run dev` copy `.env.example` to `.env` when `.env` is missing, so a fresh clone runs with zero setup.
6. Tiny `.env` loader in `lib/env.ts` for scripts that run outside Next (seed, cron, Playwright). No dotenv dependency.
