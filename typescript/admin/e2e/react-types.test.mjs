import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

test('admin typechecks when pnpm hoists mobile React types', () => {
  const admin = fileURLToPath(new URL('../', import.meta.url))
  const mobileRequire = createRequire(new URL('../../mobile/package.json', import.meta.url))
  const mobileTypes = path.dirname(mobileRequire.resolve('@types/react/package.json'))
  const hoistedTypes = path.resolve(admin, '../node_modules/.pnpm/node_modules/@types/react')
  const config = ts.getParsedCommandLineOfConfigFile(path.join(admin, 'tsconfig.json'), {
    incremental: false,
    noEmit: true,
  }, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: assert.fail })
  assert.ok(config)

  // Model either workspace winning pnpm's shared hoist without changing node_modules.
  const redirect = (file) => file === hoistedTypes || file.startsWith(hoistedTypes + path.sep)
    ? mobileTypes + file.slice(hoistedTypes.length)
    : file
  const host = ts.createCompilerHost(config.options)
  for (const name of ['fileExists', 'readFile', 'directoryExists', 'realpath']) {
    const original = host[name].bind(host)
    host[name] = (file, ...args) => original(redirect(file), ...args)
  }
  const program = ts.createProgram({ rootNames: config.fileNames, options: config.options, host })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.ok(program.getSourceFile(path.join(mobileTypes, 'index.d.ts')), 'exercise mobile React types')
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => admin,
    getNewLine: () => '\n',
  }))
})
