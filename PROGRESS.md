# Progress log

Running log for the Campaign Bank build. Newest entries at the bottom of each section.

## Done

- 2026-09-25: Read HANDOFF.md, PROMPT.md, the prototype source and the two reference screenshots.
- 2026-09-25: Found the folder with `package.json` and `node_modules` already installed from a previous attempt but no commits and no source. Kept the dependencies and continued.
- 2026-09-25: Scaffold and tooling. Next 15 App Router, TypeScript 5.9 (was 6.0, pinned down for Next and typescript-eslint support), ESLint 9 flat config, Vitest, Playwright with Chromium installed inside `node_modules` so nothing outside the folder is written. Prototype CSS ported verbatim into `app/globals.css`.

## Next

- Prisma schema and seed.

## Problems and fixes

- TypeScript 6.0 was installed by the previous attempt. Next 15.5 and typescript-eslint do not support it yet, so pinned to 5.9.
