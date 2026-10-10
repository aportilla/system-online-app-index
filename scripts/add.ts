/**
 * Files a built app file in the index, at the path its manifest gives it:
 * `npm run add -- ../meteors-app/dist/Meteors.png`. It refuses a version
 * that's already here, since a published version never changes, and a file
 * the build would refuse.
 */

import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { readAppFile } from 'vintage-frames/shell/pure'
import { listingOf, pathOf } from './listing.ts'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const given = process.argv[2]
if (!given) fail('Name the app file to add: npm run add -- ../meteors-app/dist/Meteors.png')
// npm runs a script from the repo's root, and INIT_CWD is where it was run.
const source = resolve(process.env.INIT_CWD ?? process.cwd(), given)
process.chdir(join(import.meta.dirname, '..'))

const bytes = new Uint8Array(await readFile(source))
const file = await readAppFile(bytes)
if (!file) fail(`${given} isn't an app file`)
const { name, version } = file.manifest
const path = pathOf(file.manifest)

const refused = await listingOf([{ path, bytes }])
if (Array.isArray(refused)) fail(refused.join('\n'))
const folder = dirname(path)
if (existsSync(folder) && (await readdir(folder)).some((f) => !f.startsWith('.'))) {
  fail(`${name} ${version} is already in the index, at ${folder}/. A published version never changes, so a fix is a new version.`)
}

await mkdir(folder, { recursive: true })
await copyFile(source, path)
console.log(`Filed ${name} ${version} at ${path}. Commit and push to publish it.`)
