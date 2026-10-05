/**
 * Buffer polyfill for Hermes.
 * Many crypto/encoding libraries expect Node's Buffer global.
 */
const { Buffer } = require('buffer')

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer
}
