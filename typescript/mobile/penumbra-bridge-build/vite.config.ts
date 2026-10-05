import { defineConfig, type Plugin } from 'vite'
import { readFileSync } from 'fs'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { viteSingleFile } from 'vite-plugin-singlefile'

/** Vite plugin: import .bin files as base64-encoded strings. */
function binaryBase64Plugin(): Plugin {
  return {
    name: 'binary-base64',
    transform(_, id) {
      if (id.endsWith('.bin')) {
        const data = readFileSync(id)
        return `export default "${data.toString('base64')}"`
      }
    },
  }
}

export default defineConfig({
  plugins: [
    binaryBase64Plugin(),
    wasm(),
    topLevelAwait(),
    viteSingleFile(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    minify: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
})
