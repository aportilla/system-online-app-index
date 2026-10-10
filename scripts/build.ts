/**
 * The index's build: reads every file under apps/ and writes dist/, the
 * files at their paths, index.json and _headers. A file it refuses fails
 * the build, named. Cloudflare runs it on every push to main.
 */

import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { listingOf } from './listing.ts'
import type { AppFileEntry } from './listing.ts'

process.chdir(join(import.meta.dirname, '..'))

/** Every file under apps/, by its path from the repo's root. Hidden ones, such as .DS_Store, are left out. */
async function appFiles(): Promise<AppFileEntry[]> {
  if (!existsSync('apps')) return []
  const found = await readdir('apps', { recursive: true, withFileTypes: true })
  const paths = found.filter((f) => f.isFile()).map((f) => join(f.parentPath, f.name))
  const shown = paths.filter((path) => !path.split('/').some((s) => s.startsWith('.')))
  return Promise.all(shown.map(async (path) => ({ path, bytes: new Uint8Array(await readFile(path)) })))
}

const listing = await listingOf(await appFiles())
if (Array.isArray(listing)) {
  for (const line of listing) console.error(line)
  process.exit(1)
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist')
if (existsSync('apps')) await cp('apps', 'dist/apps', { recursive: true, filter: (from) => !basename(from).startsWith('.') })
await cp('_headers', 'dist/_headers')
await writeFile('dist/index.json', `${JSON.stringify(listing, null, 2)}\n`)

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
const versions = listing.apps.reduce((n, app) => n + app.versions.length, 0)
console.log(`dist/index.json: ${count(listing.apps.length, 'application')}, ${count(versions, 'version')}`)
