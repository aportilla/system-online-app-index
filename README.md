# system-online-app-index

The index of [SystemOnline](https://github.com/aportilla/system-online)'s
applications: every published app file, and `index.json`, built from them.
SystemOnline's App Store reads it to show the applications a desktop can
run and to install them, so a release is a file committed here, and
SystemOnline never redeploys for one. The design is SystemOnline's
`docs/app-store-plan.md`, §3.1.

An app file is an application on the shell of
[system-online-sdk](https://www.npmjs.com/package/system-online-sdk), as
one PNG: its picture is the application's box, and its chunks carry its
manifest and its code. The SDK's
[`docs/APP-FILES.md`](https://github.com/aportilla/system-online-sdk/blob/main/docs/APP-FILES.md)
is the format's guide.

## Publishing

```sh
npm run add -- ../meteors-app/dist/Meteors.png
git add apps
git commit -m "Publish Meteors 0.3.1"
git push
```

`npm run add` reads the file's manifest, signs it, and files it at
`apps/<id>/<version>/<Name>.png`. It refuses a file that isn't an app file,
saying why, and a version that's already here: a published version never
changes, so a fix is a new version. Cloudflare builds `main` and serves
`dist/` at `https://apps.portill.io/`.

The index keeps a build for each app API level. Before SystemOnline takes
an SDK release that raises `APP_API_OLDEST`, build each application on it
and publish the build here. At each SDK minor, move this repo's
`system-online-sdk` range too, so it reads what the new SDK writes.

## Signatures

Every file is signed, so a desktop that holds the index's public key
installs it without asking and offers its updates (the SDK's
[`docs/APP-FILES.md` § Signing](https://github.com/aportilla/system-online-sdk/blob/main/docs/APP-FILES.md#signing)).

- `npm run add` signs with the private key in
  `~/.config/system-online/signing-key`, or in the file `SIGNING_KEY_FILE`
  names. The key never leaves the machine that signs, and is never in this
  repo.
- `scripts/signing.ts` lists the public keys the index signs with, and
  SystemOnline's trust holds the same. A new key goes in beside the old,
  in both.
- The build checks every file's signature and never signs. It refuses a
  signature that doesn't hold, one by a key that isn't listed, and an
  unsigned file, but for the four published before the index signed, which
  `scripts/signing.ts` names. CI runs the build on every push.

## index.json

```json
{
  "format": 1,
  "apps": [
    {
      "id": "meteors",
      "versions": [
        {
          "version": "0.3.0",
          "name": "Meteors",
          "author": "Adam Portilla",
          "description": "An Asteroids-style game on a 320 × 240 1-bit screen.",
          "requires": "^0.2.0",
          "api": 3,
          "icon": "data:image/png;base64,iVBORw0KGgo…",
          "file": "apps/meteors/0.3.0/Meteors.png",
          "bytes": 11904,
          "sha256": "3f2096bc…"
        }
      ]
    }
  ]
}
```

- `format` is the listing's own. A store refuses one it doesn't know, and a
  new format goes beside the old one, under a new name.
- Applications are listed by name, and each one's versions newest first.
- Each version carries its manifest's fields but `format`, so a store
  chooses a build without fetching every file: a desktop runs one whose
  `api` its SDK runs (`appRuns`). `description` is there when the manifest
  has one. `file` is relative to `index.json`, and `bytes` and `sha256` let
  a store check what it fetched.

`npm run build` reads every file under `apps/` with the SDK's reader, and
refuses, naming each one, a file that isn't an app file (saying why), one
whose id, version or name isn't its path's, one whose signature the index
doesn't take (§ Signatures), and a second file for one version. The
manifest is the source of truth, so the listing can't say anything the
files don't.

## The host

`_headers` sets:

- `Access-Control-Allow-Origin: *` on everything, since SystemOnline reads
  the index from another origin;
- `index.json` revalidated on every fetch, so a publish shows at once;
- each app file cached for a year as immutable, since its path never
  changes.

Nothing between may re-encode an app file: its chunks are the application.
Keep image optimization, such as Cloudflare's Polish, off for the host.

| Script | What it does |
| --- | --- |
| `npm run add -- <file>` | signs an app file and files it at its path in `apps/` |
| `npm run build` | `dist/`: the files, `index.json` and `_headers` |
| `npm test` | unit tests for the listing (`node --test`) |
| `npm run typecheck` | `tsc` over the scripts |
