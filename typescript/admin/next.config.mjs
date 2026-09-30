import { createRequire } from "module"

const require = createRequire(import.meta.url)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Two dev servers sharing .next corrupt each other's route manifests; set
  // NEXT_DIST_DIR for secondary instances (e.g. e2e verification servers).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@bankd/shared', '@bankd/shieldd-web'],
  experimental: {
    instrumentationHook: true,
    cpus: 2,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Fix libsodium-wrappers-sumo ESM module resolution issue
    // Fix @noble/hashes v2 exports using .js extensions (e.g. "./sha3.js" not "./sha3")
    config.resolve.alias = {
      ...config.resolve.alias,
      "libsodium-wrappers-sumo": require.resolve("libsodium-wrappers-sumo"),
      "@noble/hashes/sha3": require.resolve("@noble/hashes/sha3.js"),
    }

    // Enable WASM support (required for @mizufinance/wasm)
    config.experiments = {
      ...(config.experiments ?? {}),
      asyncWebAssembly: true,
      layers: true,
    }

    // Ensure WASM files are properly handled in workers
    if (!isServer) {
      config.output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm'
    }

    return config
  },
}

export default nextConfig
