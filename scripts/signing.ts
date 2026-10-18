/**
 * Whose signatures the index takes: the build and npm run add check every
 * file against these. SystemOnline's trust holds the same keys.
 */

import type { Signing } from './listing.ts'

export const SIGNING: Signing = {
  // Made 2026-10-18 with the SDK's generateSigningKeys(). A new key goes in
  // beside it, and into SystemOnline's trust.
  keys: ['lN1OZiOf2BlaY7GUL7IcAFKNQ81uml1/vuR8ktRqLMM='],
  // Published before the index signed. A published version never changes,
  // so these stay unsigned.
  unsigned: [
    'apps/desktop-patterns/0.2.0/Desktop Patterns.png',
    'apps/font-viewer/0.2.0/Font Viewer.png',
    'apps/meteors/0.3.0/Meteors.png',
    'apps/text-viewer/0.2.0/Text Viewer.png',
  ],
}
