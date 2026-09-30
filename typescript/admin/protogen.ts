import path from 'path'
import { fileURLToPath } from 'url'

import telescope from '@cosmology/telescope'
import { sync as rimraf } from 'rimraf'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const protoDirs = [path.join(__dirname, './proto')]
const outPath = path.join(__dirname, './src/lib/proto/')
rimraf(outPath)

telescope({
  protoDirs,
  outPath,

  // all options are totally optional ;)
  options: {
    interfaces: {
      enabled: true,
      useUseInterfacesParams: true,
      useByDefault: false,
      useByDefaultRpc: true,
      useUnionTypes: false,
    },
    tsDisable: {
      patterns: [
        '**/*.registry.ts',
        '**/authz.ts',
        '**/binary.ts',
        '**/tx.ts',
        '**/utf8.ts',
        '**/genesis.ts',
        '**/gov.ts',
        '**/query.ts',
      ],
    },
    removeUnusedImports: true,
    aminoEncoding: {
      enabled: true,
    },
    lcdClients: {
      enabled: false,
    },
    rpcClients: {
      enabled: true,
      camelCase: true,
      useConnectComet: true,
    },
    prototypes: {
      addTypeUrlToDecoders: true,
      addTypeUrlToObjects: true,
      allowUndefinedTypes: true,
      includePackageVar: false,
      methods: {
        fromJSON: false,
        toJSON: false,
        encode: true,
        decode: true,
        fromPartial: true,
        toAmino: true,
        fromAmino: true,
        fromProto: true,
        toProto: true,
      },
      parser: {
        keepCase: false,
      },
      typingsFormat: {
        duration: 'duration',
        timestamp: 'date',
        useExact: false,
        useDeepPartial: false,
        num64: 'bigint',
        customTypes: {
          useCosmosSDKDec: true,
        },
      },
      includes: {
        packages: [
          'mizufinance.native.v1',
          'mizufinance.eem.v1',
          'mizufinance.poa.v1',
          'mizufinance.unwrap.v1',
          'cosmos.bank.v1beta1',
          'cosmos.staking.v1beta1',
          'cosmos.evm.vm.v1',
          'cosmos.evm.erc20.v1',
          'ibc.core.channel.v1',
          'ibc.applications.transfer.v1',
        ]
      }
    },

    // you can scope options to certain packages:
    packages: {
    },
  },
})
  .then(() => {
    console.log('✨ all done!')
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
