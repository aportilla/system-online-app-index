// The listing (scripts/listing.ts): a folder of app files reads to the
// listing, and every file the index can't hold is refused, named. The files
// are written here by the SDK's own writer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeAppFile } from 'system-online-sdk/build'
import { APP_API, APP_FILE_FORMAT } from 'system-online-sdk/pure'

import { listingOf, pathOf } from '../scripts/listing.ts'

/** A 1 × 1 PNG: the box each file is written on, and its icon. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const BOX = new Uint8Array(Buffer.from(PNG, 'base64'))
const ICON = `data:image/png;base64,${PNG}`

const manifest = (fields) => ({
  format: APP_FILE_FORMAT,
  id: 'meteors',
  name: 'Meteors',
  version: '0.1.0',
  requires: '^0.2.0',
  api: APP_API,
  author: 'Adam Portilla',
  description: 'An Asteroids-style game.',
  icon: ICON,
  ...fields,
})

/** An app file for a manifest with `fields`, at its manifest's path or at `path`. */
async function filed(fields = {}, path) {
  const m = manifest(fields)
  return { path: path ?? pathOf(m), bytes: await writeAppFile(BOX, m, 'export default () => ({})\n') }
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** Asserts that `files` are refused, a line for each of `named`, naming it. */
async function assertRefused(files, named) {
  const refused = await listingOf(files)
  assert.ok(Array.isArray(refused), 'refused')
  assert.equal(refused.length, named.length, refused.join('\n'))
  for (const path of named) assert.ok(refused.some((line) => line.startsWith(`${path}: `)), `${path} is named`)
}

test('a folder of app files reads to the listing: applications by name, versions newest first', async () => {
  // Built at a level past this SDK's: the index lists every build, and the store chooses.
  const newest = await filed({ version: '0.10.0', requires: '^0.3.0', api: APP_API + 1 })
  const listing = await listingOf([
    await filed({ version: '0.2.0' }),
    newest,
    await filed({ version: '0.1.0' }),
    await filed({ id: 'desktop-patterns', name: 'Desktop Patterns', version: '1.0.0' }),
  ])
  assert.equal(listing.format, 1)
  assert.deepEqual(
    listing.apps.map((app) => [app.id, app.versions.map((v) => v.version)]),
    [
      ['desktop-patterns', ['1.0.0']],
      ['meteors', ['0.10.0', '0.2.0', '0.1.0']],
    ]
  )
  assert.deepEqual(listing.apps[1].versions[0], {
    version: '0.10.0',
    name: 'Meteors',
    author: 'Adam Portilla',
    description: 'An Asteroids-style game.',
    requires: '^0.3.0',
    api: APP_API + 1,
    icon: ICON,
    file: 'apps/meteors/0.10.0/Meteors.png',
    bytes: newest.bytes.length,
    sha256: sha256(newest.bytes),
  })
})

test("a version's file is a URL relative to index.json", async () => {
  const listing = await listingOf([await filed({ id: 'desktop-patterns', name: 'Desktop Patterns' })])
  assert.equal(listing.apps[0].versions[0].file, 'apps/desktop-patterns/0.1.0/Desktop%20Patterns.png')
})

test('a version whose manifest has no description is listed without one', async () => {
  const listing = await listingOf([await filed({ description: undefined })])
  assert.equal('description' in listing.apps[0].versions[0], false)
})

test('a release comes after its prereleases, and numeric identifiers go by value', async () => {
  const listing = await listingOf([
    await filed({ version: '1.0.0-beta.2' }),
    await filed({ version: '1.0.0' }),
    await filed({ version: '1.0.0-beta.10' }),
  ])
  assert.deepEqual(
    listing.apps[0].versions.map((v) => v.version),
    ['1.0.0', '1.0.0-beta.10', '1.0.0-beta.2']
  )
})

test('no files list no applications', async () => {
  assert.deepEqual(await listingOf([]), { format: 1, apps: [] })
})

test('a file not at apps/<id>/<version>/<Name>.png is refused', async () => {
  const { bytes } = await filed()
  const paths = ['apps/meteors/Meteors.png', 'apps/meteors/0.1.0/old/Meteors.png', 'apps/meteors/0.1.0/Meteors.txt', 'apps/../0.1.0/Meteors.png']
  await assertRefused(
    paths.map((path) => ({ path, bytes })),
    paths
  )
})

test("a file that isn't an app file is refused", async () => {
  await assertRefused(
    [
      { path: 'apps/meteors/0.1.0/Meteors.png', bytes: BOX },
      { path: 'apps/meteors/0.2.0/Meteors.png', bytes: new TextEncoder().encode('not a PNG') },
    ],
    ['apps/meteors/0.1.0/Meteors.png', 'apps/meteors/0.2.0/Meteors.png']
  )
})

test("a file whose manifest isn't its path's is refused", async () => {
  await assertRefused(
    [
      await filed({ id: 'rocks' }, 'apps/meteors/0.1.0/Meteors.png'),
      await filed({ version: '0.3.0' }, 'apps/meteors/0.2.0/Meteors.png'),
      await filed({ name: 'Rocks' }, 'apps/meteors/0.4.0/Meteors.png'),
    ],
    ['apps/meteors/0.1.0/Meteors.png', 'apps/meteors/0.2.0/Meteors.png', 'apps/meteors/0.4.0/Meteors.png']
  )
})

test('a second file for one id and version is refused', async () => {
  await assertRefused([await filed(), await filed({ name: 'Rocks' })], ['apps/meteors/0.1.0/Rocks.png'])
})

test('every refused file is named, and none is listed', async () => {
  await assertRefused(
    [await filed(), { path: 'apps/meteors/0.2.0/Meteors.png', bytes: BOX }, await filed({ version: '0.4.0' }, 'apps/meteors/0.3.0/Meteors.png')],
    ['apps/meteors/0.2.0/Meteors.png', 'apps/meteors/0.3.0/Meteors.png']
  )
})
