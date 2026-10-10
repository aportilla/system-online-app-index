# system-online-app-index

The index of SystemOnline's applications (the sibling `system-online` repo;
its `docs/app-store-plan.md` §3.1 is the design): every published app file
under `apps/`, and `index.json`, built from them into `dist/`.
SystemOnline's App Store reads it from another origin. An app file's format
is the `vintage-frames` kit's, whose `docs/APP-FILES.md` is the guide.

## Commands

- `npm run add -- <app file>` — files a built app file at
  `apps/<id>/<version>/<Name>.png`, refusing a version already there
- `npm run build` — reads and checks every file under `apps/`, and writes
  `dist/`: the files, `index.json` and `_headers`. Cloudflare runs it on
  every push to `main` and serves `dist/`.
- The gates: `npm test`, `npm run typecheck`, `npm run build`. CI runs all
  three on every push and pull request.

## Tests

Unit tests only, for the build's pure half, `scripts/listing.ts`
(`test/*.test.mjs`, run by `node --test`, importing the TypeScript source
through Node's type stripping). The files under test are written in the
test by the kit's own `writeAppFile`. Nothing asserts copy: a refusal is
checked for naming its file.

## Invariants — don't break, don't re-litigate

- **A published version never changes.** A file under `apps/` is never
  edited, replaced or renamed, and a fix is a new version. Stores cache
  each file for a year by its path.
- **The listing is built from the files**, never written by hand: each
  manifest is the source of truth.
- **The kit reads the files.** The scripts import
  `vintage-frames/shell/pure` only, and the tests `vintage-frames/build`
  as well, for writing files; never a deep path into its `dist/`. What the
  index needs and the kit doesn't do is a kit change, asked for in the
  kit's `feature-requests/<name>.md`. `scripts/versions.ts` is a copy of
  the kit's version comparison until its `store-helpers.md` ships, and then
  goes.
- **Nothing re-encodes an app file**: its chunks are the application.
- `dist/` is a build output — regenerate, don't hand-edit.
- Comments are short and direct: label a section or state a non-obvious
  constraint.

## Commits

Concise messages: a summary line plus at most a few sentences. No co-author
or generated-by trailers.
