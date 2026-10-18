# system-online-app-index

The index of SystemOnline's applications (the sibling `system-online` repo;
its `docs/app-store-plan.md` §3.1 is the design): every published app file
under `apps/`, and `index.json`, built from them into `dist/`.
SystemOnline's App Store reads it from another origin. An app file's format
is `system-online-sdk`'s, whose `docs/APP-FILES.md` is the guide
(`../system-online-sdk/docs/` in a checkout beside this one).

## Commands

- `npm run add -- <app file>` — signs a built app file with the private key
  in `~/.config/system-online/signing-key` (or the file `SIGNING_KEY_FILE`
  names) and files it at `apps/<id>/<version>/<Name>.png`, refusing a
  version already there
- `npm run build` — reads and checks every file under `apps/`, its
  signature among it, and writes `dist/`: the files, `index.json` and
  `_headers`. It never signs. Cloudflare runs it on every push to `main`
  and serves `dist/`.
- The gates: `npm test`, `npm run typecheck`, `npm run build`. CI runs all
  three on every push and pull request.

## Tests

Unit tests only, for the build's pure half, `scripts/listing.ts`
(`test/*.test.mjs`, run by `node --test`, importing the TypeScript source
through Node's type stripping). The files under test are written in the
test by the SDK's own `writeAppFile`, which won't write a manifest its
reader refuses, and signed by its `signAppFile` with a key the test makes.
Nothing asserts copy: a refusal is checked for naming its file.

## Invariants — don't break, don't re-litigate

- **A published version never changes.** A file under `apps/` is never
  edited, replaced or renamed, and a fix is a new version. Stores cache
  each file for a year by its path.
- **The listing is built from the files**, never written by hand: each
  manifest is the source of truth.
- **The SDK reads the files.** The scripts import `system-online-sdk/pure`,
  and `add.ts` `system-online-sdk/build` as well, for signing; the tests
  import both, for writing and signing files; never a deep path into its
  `dist/`. vintage-frames comes in as the SDK's peer, and nothing here
  imports it. What the index needs and the SDK doesn't do is an SDK change,
  asked for in the SDK's `feature-requests/<name>.md`.
- **Every file is signed** by a key `scripts/signing.ts` lists, but the
  four published before the index signed, which it names. The private key
  is a file on the machine that signs, never in this repo, and nothing
  prints it.
- **Nothing re-encodes an app file**: its chunks are the application.
  Signing adds its own chunk and leaves every other byte as it was.
- `dist/` is a build output — regenerate, don't hand-edit.
- Comments are short and direct: label a section or state a non-obvious
  constraint.

## Commits

Concise messages: a summary line plus at most a few sentences. No co-author
or generated-by trailers.
