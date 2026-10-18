// The listing (scripts/listing.ts): a folder of app files reads to the
// listing, and every file the index can't hold is refused, named. The files
// are written here by the SDK's own writer, and signed by its own signer
// with a key made here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { generateSigningKeys, signAppFile, writeAppFile } from 'system-online-sdk/build'
import { APP_API, APP_FILE_FORMAT } from 'system-online-sdk/pure'

import { listingOf, pathOf } from '../scripts/listing.ts'

/** A 1 × 1 PNG: the box each file is written on, and its icon. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const BOX = new Uint8Array(Buffer.from(PNG, 'base64'))
const ICON = `data:image/png;base64,${PNG}`
const CODE = 'export default () => ({})\n'

const KEYS = await generateSigningKeys()
const SIGNING = { keys: [KEYS.publicKey], unsigned: [] }

/** The bytes of a PNG's IEND chunk, which ends every file written here. */
const IEND = 12

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

/** A signed app file for a manifest with `fields`, at its manifest's path or at `path`. */
async function filed(fields = {}, path) {
  const m = manifest(fields)
  return { path: path ?? pathOf(m), bytes: await signAppFile(await writeAppFile(BOX, m, CODE), KEYS.privateKey) }
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** Asserts that `files` are refused, a line for each of `named`, naming it. */
async function assertRefused(files, named, signing = SIGNING) {
  const refused = await listingOf(files, signing)
  assert.ok(Array.isArray(refused), 'refused')
  assert.equal(refused.length, named.length, refused.join('\n'))
  for (const path of named) assert.ok(refused.some((line) => line.startsWith(`${path}: `)), `${path} is named`)
}

test('a folder of app files reads to the listing: applications by name, versions newest first', async () => {
  // Built at a level past this SDK's: the index lists every build, and the store chooses.
  const newest = await filed({ version: '0.10.0', requires: '^0.3.0', api: APP_API + 1 })
  const listing = await listingOf(
    [
      await filed({ version: '0.2.0' }),
      newest,
      await filed({ version: '0.1.0' }),
      await filed({ id: 'desktop-patterns', name: 'Desktop Patterns', version: '1.0.0' }),
    ],
    SIGNING
  )
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
  const listing = await listingOf([await filed({ id: 'desktop-patterns', name: 'Desktop Patterns' })], SIGNING)
  assert.equal(listing.apps[0].versions[0].file, 'apps/desktop-patterns/0.1.0/Desktop%20Patterns.png')
})

test('a version whose manifest has no description is listed without one', async () => {
  const listing = await listingOf([await filed({ description: undefined })], SIGNING)
  assert.equal('description' in listing.apps[0].versions[0], false)
})

test('a release comes after its prereleases, and numeric identifiers go by value', async () => {
  const listing = await listingOf(
    [await filed({ version: '1.0.0-beta.2' }), await filed({ version: '1.0.0' }), await filed({ version: '1.0.0-beta.10' })],
    SIGNING
  )
  assert.deepEqual(
    listing.apps[0].versions.map((v) => v.version),
    ['1.0.0', '1.0.0-beta.10', '1.0.0-beta.2']
  )
})

test('no files list no applications', async () => {
  assert.deepEqual(await listingOf([], SIGNING), { format: 1, apps: [] })
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

test("a file signed by a key the index doesn't sign with is refused", async () => {
  const other = await generateSigningKeys()
  const m = manifest({ version: '0.2.0' })
  const foreign = { path: pathOf(m), bytes: await signAppFile(await writeAppFile(BOX, m, CODE), other.privateKey) }
  await assertRefused([await filed(), foreign], [foreign.path])
})

test('a file changed since it was signed is refused', async () => {
  // Meteors 0.1.0's signature, moved onto a file whose author isn't its.
  const original = await writeAppFile(BOX, manifest(), CODE)
  const signed = await signAppFile(original, KEYS.privateKey)
  const signature = signed.subarray(original.length - IEND, signed.length - IEND)
  const changed = await writeAppFile(BOX, manifest({ author: 'Someone Else' }), CODE)
  const forged = new Uint8Array(Buffer.concat([changed.subarray(0, changed.length - IEND), signature, changed.subarray(changed.length - IEND)]))
  await assertRefused([{ path: 'apps/meteors/0.1.0/Meteors.png', bytes: forged }], ['apps/meteors/0.1.0/Meteors.png'])
})

test('an unsigned file is refused, but for one published before the index signed', async () => {
  const before = { path: 'apps/meteors/0.1.0/Meteors.png', bytes: await writeAppFile(BOX, manifest(), CODE) }
  const after = { path: 'apps/meteors/0.2.0/Meteors.png', bytes: await writeAppFile(BOX, manifest({ version: '0.2.0' }), CODE) }
  const signing = { ...SIGNING, unsigned: [before.path] }
  const listing = await listingOf([before, await filed({ version: '0.3.0' })], signing)
  assert.deepEqual(
    listing.apps[0].versions.map((v) => v.version),
    ['0.3.0', '0.1.0']
  )
  await assertRefused([before, after], [after.path], signing)
})

test('every refused file is named, and none is listed', async () => {
  await assertRefused(
    [await filed(), { path: 'apps/meteors/0.2.0/Meteors.png', bytes: BOX }, await filed({ version: '0.4.0' }, 'apps/meteors/0.3.0/Meteors.png')],
    ['apps/meteors/0.2.0/Meteors.png', 'apps/meteors/0.3.0/Meteors.png']
  )
})
