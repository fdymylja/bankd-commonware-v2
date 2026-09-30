import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const stage = await mkdtemp(join(tmpdir(), 'bankd-sdk-'))
const source = join(root, 'admin/vendor/mizufinance-wasm-53.0.1-bankd-demo.19.tgz')
execFileSync('tar', ['-xf', source, '-C', stage])
const wasmDir = join(stage, 'package/wasm')
for (const name of ['index.js', 'index.d.ts', 'index_bg.wasm', 'index_bg.wasm.d.ts']) await cp(join(root, 'packages/shieldd-web/wasm', name), join(wasmDir, name))
const wasmSha256 = createHash('sha256').update(await readFile(join(wasmDir, 'index_bg.wasm'))).digest('hex')
const cargoLockSha256 = createHash('sha256').update(await readFile(join(root, 'packages/shieldd-web/crate/Cargo.lock'))).digest('hex')
const provenance = { sourceRepository: 'https://github.com/mizufinance/bankd-commonware-v2', wrapperSourceRepository: 'https://github.com/mizufinance/shieldd-web', wrapperSourceRevision: 'b731744fec5012d50746f06337eac03f39722e75', shielddRevision: execFileSync('git', ['-C', join(root, 'shieldd'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), buildProfile: 'development', wasmSha256, cargoLockSha256 }
await writeFile(join(stage, 'package/build-provenance.json'), JSON.stringify(provenance, null, 2) + '\n')
const manifestPath = join(stage, 'package/package.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.version = '53.0.1-bankd-commonware.1'
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
const output = join(root, 'admin/vendor/mizufinance-wasm-53.0.1-bankd-commonware.1.tgz')
execFileSync('tar', ['-czf', output, '-C', stage, 'package'])
console.log(output)
