# Native Wallet

One wallet for both the public EVM and private Shieldd sides of bankd, from a single BIP39 seed phrase, with optional passkey (WebAuthn) auth.

## Overview

Replaces external wallets (MetaMask, Prax extension) with a built-in one:

- **Single seed phrase** to multiple address types (EVM + Shieldd)
- **Passkey auth** for biometric/hardware key login (no password)
- **Wagmi integration** works with existing EVM hooks
- **Local key management** - keys never leave the browser

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          React Application                               │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     WalletProvider (Context)                      │   │
│  │  - initState: 'uninitialized' | 'locked' | 'unlocked'            │   │
│  │  - addresses: { evm, penumbra, penumbraTransparent }             │   │
│  │  - authMethod: 'password' | 'passkey'                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│           │                                    │                         │
│           ▼                                    ▼                         │
│  ┌─────────────────────┐            ┌─────────────────────┐             │
│  │    EVM Module       │            │  Penumbra Module    │             │
│  │  ┌───────────────┐  │            │  ┌───────────────┐  │             │
│  │  │ keys.ts       │  │            │  │ keys.ts       │  │             │
│  │  │ (HD account)  │  │            │  │ (SpendKey/FVK)│  │             │
│  │  └───────────────┘  │            │  └───────────────┘  │             │
│  │  ┌───────────────┐  │            │  ┌───────────────┐  │             │
│  │  │ connector.ts  │  │            │  │ services/     │  │             │
│  │  │ (wagmi)       │  │            │  │ (sync, tx)    │  │             │
│  │  └───────────────┘  │            │  └───────────────┘  │             │
│  └─────────────────────┘            └─────────────────────┘             │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Core Module                                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
│  │  │ wallet.ts  │  │ db.ts      │  │ encryption │  │ passkey.ts │  │   │
│  │  │ (state)    │  │ (IndexedDB)│  │ (AES-GCM)  │  │ (WebAuthn) │  │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/lib/native-wallet/
├── index.ts                    # Public exports
├── core/                       # Shared infrastructure
│   ├── index.ts
│   ├── types.ts                # Type definitions
│   ├── db.ts                   # IndexedDB operations
│   ├── encryption.ts           # AES-GCM, PBKDF2
│   ├── passkey.ts              # WebAuthn PRF authentication
│   ├── session.ts              # Auto-unlock session
│   ├── wallet.ts               # Wallet state management
│   └── context.tsx             # React context provider
├── evm/                        # EVM-specific
│   ├── index.ts
│   ├── keys.ts                 # HD account derivation (BIP44)
│   └── connector.ts            # Wagmi connector
└── penumbra/                   # Penumbra-specific
    ├── index.ts
    ├── keys.ts                 # SpendKey/FVK derivation
    ├── wasm-loader.ts          # WASM module loading
    └── services/
        ├── index.ts
        ├── view-service.ts     # Balance queries
        ├── custody-service.ts  # Transaction signing
        ├── transaction.ts      # Tx lifecycle
        ├── view-server-sync.ts # Block sync
        ├── address.ts          # Address helpers
        └── balances.ts         # Balance aggregation
```

## Security Architecture

### Key Storage

```
┌─────────────────────────────────────────────────────────────────┐
│                         IndexedDB                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ encryptedCustody: {                                        │  │
│  │   type: 'encryptedSeedPhrase',                            │  │
│  │   box: { nonce, cipherText }  ◄── AES-256-GCM encrypted   │  │
│  │ }                                                          │  │
│  │ keyPrint: { salt, hash }      ◄── For password verify     │  │
│  │ passkey: { credentialId, ... } ◄── WebAuthn credential    │  │
│  │ penumbraFVK: '...'            ◄── Safe (view-only)        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ On Unlock
┌─────────────────────────────────────────────────────────────────┐
│                        Memory Only                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ encryptionKey   │  │ EVM HDAccount   │  │ Penumbra Keys   │  │
│  │ (CryptoKey)     │  │ (derived)       │  │ (SpendKey/FVK)  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│  NOTE: Mnemonic is NOT stored in memory!                        │
│  It's decrypted on-demand for account switching, then discarded │
└─────────────────────────────────────────────────────────────────┘
```

### Security Features

| Feature | Implementation |
|---------|---------------|
| Seed encryption | AES-256-GCM with random nonce |
| Key derivation | PBKDF2 (210,000 iterations, SHA-512) |
| Password verification | Constant-time comparison |
| Mnemonic in memory | Never stored; decrypted on-demand only |
| Rate limiting | 5 failed attempts, then 1 minute lockout |
| Session persistence | Encrypted in sessionStorage, key in memory only |
| Passkey auth | WebAuthn PRF extension for key derivation |

### Passkey (WebAuthn) Authentication

Passwordless auth using biometrics or hardware keys:

```
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐
│   Browser    │────▶│  Authenticator │────▶│  PRF Extension   │
│  (WebAuthn)  │     │ (TouchID/etc) │     │ (Key Derivation) │
└──────────────┘     └───────────────┘     └──────────────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │  HKDF → AES Key  │
                                           │  (deterministic) │
                                           └──────────────────┘
```

**Browser Support:**
- Chrome 116+ ✅
- Safari 17+ ✅
- Firefox - limited (falls back to password)

**Security Benefits:**
- No password to remember or brute force
- Private key never leaves authenticator hardware
- Phishing-resistant (bound to domain)
- Encryption key derived via PRF: deterministic but unforgeable

## Usage

### React Context

```tsx
import { useNativeWallet } from '@/lib/native-wallet'

function MyComponent() {
  const {
    // State
    initState,        // 'uninitialized' | 'locked' | 'unlocked'
    addresses,        // { evm, penumbra, penumbraTransparent }
    authMethod,       // 'password' | 'passkey' | null
    hasPasskey,       // boolean
    fullViewingKey,   // Penumbra FVK (null if locked)
    isSyncing,        // Penumbra sync status
    syncProgress,     // { current, target, percentage }
    error,            // Error message if any
    
    // Wallet Actions
    createWallet,           // (seedPhrase, password, label?) => Promise
    createWalletWithPasskey, // (seedPhrase, label?) => Promise
    importWallet,           // (seedPhrase, password, label?) => Promise
    unlock,                 // (password) => Promise
    unlockWithPasskey,      // () => Promise
    lock,                   // () => void
    reset,                  // () => Promise (deletes wallet)
    exportSeedPhrase,       // (password?) => Promise<string>
    switchAccount,          // (index) => Promise
    
    // Penumbra Sync
    startSync,              // () => Promise
    stopSync,               // () => void
    
    // EVM Signing (also available via wagmi)
    signMessage,            // (message) => Promise<hex>
    signTypedData,          // (typedData) => Promise<hex>
    signTransaction,        // (tx) => Promise<hex>
  } = useNativeWallet()
}
```

### Creating a Wallet

```tsx
// With password
await createWallet(seedPhrase, 'myPassword123', 'My Wallet')

// With passkey (biometric)
await createWalletWithPasskey(seedPhrase, 'My Wallet')
// User will be prompted for Face ID / Touch ID / Security Key
```

### Unlocking

```tsx
// Password wallet
await unlock('myPassword123')

// Passkey wallet
await unlockWithPasskey()
// Triggers biometric prompt automatically
```

### Wagmi Integration

The native wallet ships a wagmi connector that works with standard wagmi hooks:

```tsx
// In wagmi config
import { nativeWallet } from '@/lib/native-wallet'

const config = createConfig({
  connectors: [nativeWallet()],
  // ...
})

// In components - works like any wagmi wallet
import { useAccount, useSignMessage, useSendTransaction } from 'wagmi'

function MyComponent() {
  const { address, isConnected } = useAccount()
  const { signMessage } = useSignMessage()
  
  // All standard wagmi hooks work
}
```

### Penumbra Services

```tsx
import { 
  createLocalViewService,
  createLocalCustodyService,
  createTransactionService,
} from '@/lib/native-wallet'

// View balances
const viewService = createLocalViewService({ fvk, grpcUrl, chainId })
for await (const balance of viewService.balances(request)) {
  console.log(balance)
}

// Build and broadcast transaction
const txService = createTransactionService({ grpcUrl, chainId })
const result = await txService.planBuildAndBroadcast(transactionPlan)
```

## Address Derivation

### EVM Addresses

Uses standard BIP44 derivation path: `m/44'/60'/0'/0/{index}`

```typescript
import { getEVMAddressInfo, getEVMAddressInfoForIndex } from '@/lib/native-wallet'

// Current account
const { hex, bech32 } = getEVMAddressInfo()
// hex: '0x1234...'
// bech32: 'wallet1...'

// Specific index (doesn't switch account)
const addr = getEVMAddressInfoForIndex(mnemonic, 1)
```

### Penumbra Addresses

```typescript
import {
  getPenumbraAddressInfo,
  getPenumbraEphemeralAddressInfo,
  getPenumbraTransparentAddressInfo,
} from '@/lib/native-wallet'

// Default shielded address (per account index)
const { address, bech32 } = await getPenumbraAddressInfo(0)
// bech32: 'penumbra1...'

// Fresh ephemeral shielded address for IBC deposit/return use.
// Same account index, new randomizer, unlinkable on public IBC packet data.
const ephemeral = await getPenumbraEphemeralAddressInfo(0)
// ephemeral.bech32: 'penumbra1...'

// Transparent address (compatibility fallback, derived from FVK)
const transparent = await getPenumbraTransparentAddressInfo()
// transparent.bech32: 'penumbratpa1...'
```

## IndexedDB Schema

Database: `native-wallet` (version 2)

| Table | Key | Purpose |
|-------|-----|---------|
| `wallet` | `'config'` | Encrypted seed, FVK, passkey credential |
| `accounts` | `index` | Account labels |
| `syncState` | - | Sync progress |
| `spendableNotes` | `noteCommitment` | Penumbra notes |
| `assetMetadata` | `assetId` | Token metadata |
| `transactions` | `txId` | Transaction history |
| `ibcDenoms` | `assetIdHex` | IBC token info |
| `TREE_*` | - | Penumbra SCT state |
| `GAS_PRICES` | - | Fee estimation |
| `FMD_PARAMETERS` | - | Fuzzy message detection |
| `APP_PARAMETERS` | - | Chain parameters |

## UI Components

### CreateWalletModal

Two-tab modal for creating or importing wallets:

- **Create New**: Generates BIP39 mnemonic, requires copy confirmation
- **Import Existing**: Paste existing seed phrase
- **Auth Selection**: Password or Passkey (if supported)

```tsx
<CreateWalletModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onCreateWallet={handleCreate}
  onCreateWalletWithPasskey={handleCreatePasskey}
  onImportWallet={handleImport}
  onImportWalletWithPasskey={handleImportPasskey}
/>
```

### UnlockModal

Adapts to wallet's auth method:

- **Password wallet**: Shows password input
- **Passkey wallet**: Shows biometric prompt button

```tsx
<UnlockModal
  isOpen={showUnlock}
  onClose={() => setShowUnlock(false)}
  onUnlock={handleUnlock}
  onUnlockWithPasskey={handleUnlockPasskey}
  hasPasskey={wallet.hasPasskey}
/>
```

### NativeWalletConfigModal

Wallet management:

- View addresses (EVM and Penumbra)
- Switch between accounts
- Add new accounts
- Export seed phrase (requires re-authentication)
- Lock wallet
- Reset wallet (delete all data)

## Auto-Connect Behavior

1. **Page load** - check wallet state
2. **If locked** - auto-show unlock modal
3. **On unlock** - auto-connect wagmi
4. **On reset** - auto-show create wallet modal

```tsx
// In Header.tsx
useEffect(() => {
  if (wallet.initState === 'locked' && wallet.authMethod !== null) {
    setShowUnlockModal(true)
  }
  if (wallet.initState === 'uninitialized') {
    setShowUnlockModal(false)
    setShowCreateModal(true)
  }
}, [wallet.initState, wallet.authMethod])

useEffect(() => {
  if (wallet.initState === 'unlocked' && !isWagmiConnected) {
    connect({ connector: nativeConnector })
  }
}, [wallet.initState, isWagmiConnected])
```

## Shieldd Block Sync

### ViewServer Sync

Uses the WASM ViewServer to scan bankd blocks:

```typescript
import { createViewServerSyncController } from '@/lib/native-wallet'

const sync = createViewServerSyncController({
  fullViewingKey,
  grpcUrl: 'http://localhost:11317',
  chainId: '9001',
  onProgress: (current, target) => {
    console.log(`Syncing: ${current}/${target}`)
  },
  onNotesFound: (count, height) => {
    console.log(`Found ${count} notes at height ${height}`)
  },
  onError: (err) => {
    console.error('Sync error:', err)
  },
})

sync.start()
// Later: sync.stop()
```

### Transaction Flow

```
Plan → Authorize → Witness → Build → Broadcast → Confirm
```

1. **Plan**: Create transaction plan with spendable notes and gas prices
2. **Authorize**: Sign with spend key (from encrypted seed)
3. **Witness**: Generate SCT Merkle proofs
4. **Build**: Create ZK proofs (uses proving keys from `/public/proving-keys/`)
5. **Broadcast**: Submit via gRPC-web
6. **Confirm**: Poll for transaction confirmation

## Environment Configuration

```env
# Shieldd runs inside bankd, so these point at the bankd node, not a separate
# Penumbra one. See admin/.env.development for the committed defaults.
NEXT_PUBLIC_PENUMBRA_CHAIN_ID=9001
NEXT_PUBLIC_PENUMBRA_RPC_URL=http://localhost:27657
NEXT_PUBLIC_PENUMBRA_GRPC_URL=http://localhost:11317

# EVM configuration
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_CHAIN_ID=9001
```

## Troubleshooting

### "Database removal blocked"

Another connection is still open. The wallet handles this by:
1. Setting an `isDeleting` flag to prevent new connections
2. Waiting for existing operations to complete
3. Resolving anyway (deletion will complete when connections close)

### "CredentialContainer request is not allowed"

WebAuthn requires user gesture. Passkey authentication cannot be auto-triggered on page load; user must click a button.

### "Not a valid SCT root"

Local SCT state doesn't match chain. Clear IndexedDB and resync:
```javascript
indexedDB.deleteDatabase('native-wallet')
```

### Passkey not working

1. Check browser support (Chrome 116+, Safari 17+)
2. Ensure HTTPS (WebAuthn requires secure context, except localhost)
3. Check if authenticator supports PRF extension

## Ephemeral Address Registry

All IBC operations (deposits, returns, swaps, loans) use freshly generated **ephemeral shielded addresses**, not the wallet's default address. This prevents on-chain linkability.

### Ephemeral Address Generation

Each IBC transaction generates a new ephemeral Penumbra address:

```typescript
import { getPenumbraEphemeralAddressInfo } from '@/lib/native-wallet'

// Fresh address for each IBC operation
const ephemeral = await getPenumbraEphemeralAddressInfo(accountIndex)
// ephemeral.bech32: 'penumbra1...' (unique, unlinkable)
```

The EEM intermediate address on Bankd is deterministically derived from the channel and the ephemeral address. A registry record is saved **before broadcast** so no address gets lost.

### Registry Import / Export

Export and import the registry when moving to a new device or app instance:

```typescript
import {
  exportAdminEphemeralAddressRegistry,
  importAdminEphemeralAddressRegistry,
} from '@/lib/native-wallet'

// Export all registry entries from IndexedDB
const backup = await exportAdminEphemeralAddressRegistry()

// Import on new device (merges, deduplicates by address)
await importAdminEphemeralAddressRegistry(backup)
```

### ⚠️ Registry Loss Warning

Losing the registry **does not lose funds** - all funds are recoverable from the seed phrase / FVK via chain sync. But losing it **does lose UI-level associations**:

- Which loan belongs to which deposit address
- Which swap order was created by which ephemeral address
- Human-readable labels and purpose tags

Always export the registry before resetting the wallet or moving devices.

---

## Migration from Prax Extension

Migrating users from the Prax extension:

1. Export seed phrase from Prax
2. Import into native wallet via the "Import Existing" tab
3. Sync rebuilds note state from chain
4. All balances and transaction history come back
