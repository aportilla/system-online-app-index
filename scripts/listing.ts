/**
 * The listing, index.json: each application, and each of its versions with
 * its manifest's fields and its file's path, size and SHA-256, built from
 * the app files under apps/. Pure: the build reads the files, and the tests
 * hand them in.
 */

import { checkSignature, compareVersions, inspectAppFile, judgeSignature } from 'system-online-sdk/pure'
import type { AppManifest } from 'system-online-sdk/pure'

/** The listing's own format. A store refuses one it doesn't know. */
export const LISTING_FORMAT = 1

export interface Listing {
  format: typeof LISTING_FORMAT
  /** By name. */
  apps: ListedApp[]
}

export interface ListedApp {
  id: string
  /** Newest first. */
  versions: ListedVersion[]
}

export interface ListedVersion {
  version: string
  name: string
  author: string
  /** Only when its manifest has one. */
  description?: string
  requires: string
  /** The app API level it was built at, which a store chooses a build by. */
  api: number
  /** Its 32 × 32 icon, a `data:` URL. */
  icon: string
  /** The app file, relative to index.json. */
  file: string
  bytes: number
  /** The file's SHA-256, in hex. */
  sha256: string
}

/** A file under apps/: its path from the repo's root, and its bytes. */
export interface AppFileEntry {
  path: string
  bytes: Uint8Array
}

/** Whose signatures the index takes. */
export interface Signing {
  /** The public keys it signs with, base64, as the SDK's generateSigningKeys() gives them. */
  keys: readonly string[]
  /** The files, by path, published before it signed, which stay unsigned. */
  unsigned: readonly string[]
}

/** Where a version of an application is filed. */
export const pathOf = ({ id, version, name }: Pick<AppManifest, 'id' | 'version' | 'name'>): string =>
  `apps/${id}/${version}/${name}.png`

/** apps/<id>/<version>/<Name>.png, no segment hidden or a step up. */
const FILED = /^apps\/([^/.][^/]*)\/([^/.][^/]*)\/([^/.][^/]*\.png)$/

/**
 * The listing of `files`, or a line for each file it refuses, naming the
 * file: one that isn't at apps/<id>/<version>/<Name>.png, isn't an app
 * file (with the SDK reader's reason), isn't at its manifest's path, isn't
 * signed by one of `signing`'s keys (its unsigned files aside), or is a
 * second file for one id and version.
 */
export async function listingOf(files: readonly AppFileEntry[], signing: Signing): Promise<Listing | string[]> {
  const refused: string[] = []
  const versions = new Map<string, ListedVersion[]>()
  const held = new Map<string, string>()
  for (const { path, bytes } of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const at = FILED.exec(path)
    if (!at) {
      refused.push(`${path}: an app file is filed at apps/<id>/<version>/<Name>.png`)
      continue
    }
    const file = await inspectAppFile(bytes)
    if (typeof file === 'string') {
      refused.push(`${path}: it isn't an app file: ${file}`)
      continue
    }
    const { id, name, version, author, description, requires, api, icon } = file.manifest
    if (path !== pathOf(file.manifest)) {
      refused.push(`${path}: it is ${name} ${version} (${id}), filed at ${pathOf(file.manifest)}`)
      continue
    }
    const check = await checkSignature(bytes)
    const { standing, key } = judgeSignature(check, { keys: signing.keys })
    if (check.status === 'broken') {
      refused.push(`${path}: its signature doesn't hold: ${check.reason}`)
      continue
    }
    if (standing === 'untrusted') {
      refused.push(`${path}: it's signed by ${key}, which isn't a key the index signs with`)
      continue
    }
    if (standing === 'unsigned' && !signing.unsigned.includes(path)) {
      refused.push(`${path}: it isn't signed; npm run add signs a file as it files it`)
      continue
    }
    const folder = path.slice(0, path.lastIndexOf('/'))
    const other = held.get(folder)
    if (other) {
      refused.push(`${path}: ${folder} already holds ${other}, and a version is one file`)
      continue
    }
    held.set(folder, at[3]!)
    const listed: ListedVersion = {
      version,
      name,
      author,
      ...(description ? { description } : {}),
      requires,
      api,
      icon,
      file: path.split('/').map(encodeURIComponent).join('/'),
      bytes: bytes.length,
      sha256: await sha256(bytes),
    }
    versions.set(id, [...(versions.get(id) ?? []), listed])
  }
  if (refused.length) return refused

  const apps = [...versions].map(([id, listed]) => ({ id, versions: listed.sort((a, b) => compareVersions(b.version, a.version)) }))
  apps.sort((a, b) => a.versions[0]!.name.localeCompare(b.versions[0]!.name, 'en') || (a.id < b.id ? -1 : 1))
  return { format: LISTING_FORMAT, apps }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice()))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}
