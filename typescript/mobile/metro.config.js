const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const expoMetroConfigPath = require.resolve('expo/metro-config')
const exclusionList = require(path.resolve(
  path.dirname(expoMetroConfigPath),
  '../@expo/metro/metro-config/defaults/exclusionList'
)).default

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// 1. Watch all files in the monorepo
config.watchFolders = [monorepoRoot]

// 2. Let Metro resolve packages from the monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// 3. Ensure @bankd/shared is resolved from the workspace
config.resolver.extraNodeModules = {
  '@bankd/shared': path.resolve(monorepoRoot, 'packages/shared'),
}

// 4. Ignore local network state and generated build artifacts that churn while
// Metro watches the monorepo root. Otherwise Fast Refresh reloads constantly.
config.resolver.blockList = exclusionList([
  /.*\/\.localnet\/.*/,
  /.*\/packages\/shared\/tsconfig\.tsbuildinfo$/,
])

// 5. Add .html as an asset extension for WebView bridge loading
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'html']

module.exports = config
