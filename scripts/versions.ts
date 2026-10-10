/**
 * Semver's order, copied from the kit's app-file reader (`compareSemver`,
 * which `satisfies` rests on), until vintage-frames/shell/pure exports it
 * as `compareVersions`: the kit's feature-requests/store-helpers.md. This
 * file goes when that ships.
 */

interface Semver {
  core: [number, number, number]
  pre: string[]
}

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/

function parseSemver(text: string): Semver | null {
  const m = SEMVER.exec(text.trim())
  return m ? { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split('.') : [] } : null
}

function compareSemver(a: Semver, b: Semver): number {
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i]! - b.core[i]!
  // A release comes after its prereleases.
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn) return Number(x) - Number(y)
    if (xn !== yn) return xn ? -1 : 1
    return x < y ? -1 : 1
  }
  return 0
}

/** Whether `text` is a version. */
export const isVersion = (text: string): boolean => parseSemver(text) !== null

/** Below zero, zero or above as `a` comes before, with or after `b`; a non-version before every version. */
export function compareVersions(a: string, b: string): number {
  const x = parseSemver(a)
  const y = parseSemver(b)
  return x && y ? compareSemver(x, y) : Number(!!x) - Number(!!y)
}
