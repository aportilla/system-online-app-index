/**
 * The listing, index.json: each application, and each of its versions with
 * its manifest's fields and its file's path, size and SHA-256, built from
 * the app files under apps/. Pure: the build reads the files, and the tests
 * hand them in.
 */

import { readAppFile } from 'vintage-frames/shell/pure'
import type { AppManifest } from 'vintage-frames/shell/pure'
import { compareVersions, isVersion } from './versions.ts'

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
  requires: string
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

/** Where a version of an application is filed. */
export const pathOf = ({ id, version, name }: Pick<AppManifest, 'id' | 'version' | 'name'>): string =>
  `apps/${id}/${version}/${name}.png`

/** apps/<id>/<version>/<Name>.png, no segment hidden or a step up. */
const FILED = /^apps\/([^/.][^/]*)\/([^/.][^/]*)\/([^/.][^/]*\.png)$/

/**
 * The listing of `files`, or a line for each file it refuses, naming the
 * file: one that isn't at apps/<id>/<version>/<Name>.png, isn't an app
 * file, has a version that isn't one, isn't at its manifest's path, or is a
 * second file for one id and version.
 */
export async function listingOf(files: readonly AppFileEntry[]): Promise<Listing | string[]> {
  const refused: string[] = []
  const versions = new Map<string, ListedVersion[]>()
  const held = new Map<string, string>()
  for (const { path, bytes } of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const at = FILED.exec(path)
    if (!at) {
      refused.push(`${path}: an app file is filed at apps/<id>/<version>/<Name>.png`)
      continue
    }
    const file = await readAppFile(bytes)
    if (!file) {
      refused.push(`${path}: it isn't an app file`)
      continue
    }
    const { id, name, version, author, requires, icon } = file.manifest
    if (!isVersion(version)) {
      refused.push(`${path}: its version, ${version}, is not a version`)
      continue
    }
    if (path !== pathOf(file.manifest)) {
      refused.push(`${path}: it is ${name} ${version} (${id}), filed at ${pathOf(file.manifest)}`)
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
      requires,
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
