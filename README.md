# system-online-app-index

The index of [SystemOnline](https://github.com/aportilla/system-online)'s
applications: every published app file, and `index.json`, built from them.
SystemOnline's App Store reads it to show the applications a desktop can
run and to install them, so a release is a file committed here, and
SystemOnline never redeploys for one. The design is SystemOnline's
`docs/app-store-plan.md`, §3.1.

An app file is an application on the
[vintage-frames](https://www.npmjs.com/package/vintage-frames) kit's shell,
as one PNG: its picture is the application's box, and its chunks carry its
manifest and its code. The kit's `docs/APP-FILES.md` is the format's guide.

## Publishing

```sh
npm run add -- ../meteors-app/dist/Meteors.png
git add apps
git commit -m "Publish Meteors 0.1.1"
git push
```

`npm run add` reads the file's manifest and files it at
`apps/<id>/<version>/<Name>.png`. It refuses a file that isn't an app file,
and a version that's already here: a published version never changes, so a
fix is a new version. Cloudflare builds `main` and serves `dist/`.

At a kit minor, publish each application's build for the new kit here
before SystemOnline takes the kit. The index keeps a build for each kit.

## index.json

```json
{
  "format": 1,
  "apps": [
    {
      "id": "meteors",
      "versions": [
        {
          "version": "0.1.0",
          "name": "Meteors",
          "author": "Adam Portilla",
          "requires": "^0.17.0",
          "icon": "data:image/png;base64,iVBORw0KGgo…",
          "file": "apps/meteors/0.1.0/Meteors.png",
          "bytes": 11755,
          "sha256": "de44a3d9…"
        }
      ]
    }
  ]
}
```

- `format` is the listing's own. A store refuses one it doesn't know, and a
  new format goes beside the old one, under a new name.
- Applications are listed by name, and each one's versions newest first.
- Each version carries its manifest's fields, so a store chooses a build
  without fetching every file. `file` is relative to `index.json`, and
  `bytes` and `sha256` let a store check what it fetched.

`npm run build` reads every file under `apps/` with the kit's reader, and
refuses, naming each one, a file that isn't an app file, one whose id,
version or name isn't its path's, and a second file for one version. The
manifest is the source of truth, so the listing can't say anything the files
don't.

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
| `npm run add -- <file>` | files an app file at its path in `apps/` |
| `npm run build` | `dist/`: the files, `index.json` and `_headers` |
| `npm test` | unit tests for the listing (`node --test`) |
| `npm run typecheck` | `tsc` over the scripts |
