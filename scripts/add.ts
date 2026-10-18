/**
 * Signs a built app file and files it in the index, at the path its
 * manifest gives it: `npm run add -- ../meteors-app/dist/Meteors.png`. The
 * private key is a file on this machine, never in the repo:
 * ~/.config/system-online/signing-key, or the one SIGNING_KEY_FILE names.
 * It refuses a version that's already here, since a published version
 * never changes, and a file the build would refuse.
 */

import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { signAppFile } from 'system-online-sdk/build'
import { inspectAppFile } from 'system-online-sdk/pure'
import { listingOf, pathOf } from './listing.ts'
import { SIGNING } from './signing.ts'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const given = process.argv[2]
if (!given) fail('Name the app file to add: npm run add -- ../meteors-app/dist/Meteors.png')
// npm runs a script from the repo's root, and INIT_CWD is where it was run.
const here = process.env.INIT_CWD ?? process.cwd()
const source = resolve(here, given)
const keyFile = process.env.SIGNING_KEY_FILE ? resolve(here, process.env.SIGNING_KEY_FILE) : join(homedir(), '.config/system-online/signing-key')
process.chdir(join(import.meta.dirname, '..'))

const bytes = new Uint8Array(await readFile(source))
const file = await inspectAppFile(bytes)
if (typeof file === 'string') fail(`${given} isn't an app file: ${file}`)
const { name, version } = file.manifest
const path = pathOf(file.manifest)

// The key is read here and never printed.
if (!existsSync(keyFile)) fail(`No signing key at ${keyFile}. Make a key pair with the SDK's generateSigningKeys() (its docs/APP-FILES.md § Signing), or set SIGNING_KEY_FILE.`)
let signed: Uint8Array
try {
  signed = await signAppFile(bytes, (await readFile(keyFile, 'utf8')).trim())
} catch (error) {
  fail(`${keyFile} doesn't sign: ${(error as Error).message}`)
}

const refused = await listingOf([{ path, bytes: signed }], SIGNING)
if (Array.isArray(refused)) fail(refused.join('\n'))
const folder = dirname(path)
if (existsSync(folder) && (await readdir(folder)).some((f) => !f.startsWith('.'))) {
  fail(`${name} ${version} is already in the index, at ${folder}/. A published version never changes, so a fix is a new version.`)
}

await mkdir(folder, { recursive: true })
await writeFile(path, signed)
console.log(`Signed ${name} ${version} and filed it at ${path}. Commit and push to publish it.`)
