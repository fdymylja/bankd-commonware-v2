import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha2.js'

// This is the single place the BlockSignature crypto lives. It mirrors the live
// Shinzo generator exactly (shinzo-generator-client pkg/defra/block_handler.go):
// the generator signs the raw block merkle-root bytes with its DefraDB secp256k1
// identity key, and DefraDB's secp256k1 Sign is a DER-encoded ECDSA signature
// over sha256(message). So verification is:
//
//   pub    = decompress(hex signatureIdentity)   // 33-byte compressed key
//   digest = sha256(hex-decode merkleRoot)
//   ecdsa_verify(DER(hex signatureValue), digest, pub)
//
// signatureIdentity and signatureValue are lower/upper hex (optionally 0x
// prefixed); merkleRoot is the hex string from the BlockSignature document. Any
// malformed, empty, wrong-length, or non-verifying input returns false so
// callers fail closed and never count an unverified claim toward quorum.

export type BlockSignatureInput = {
  identity: string
  signatureValue: string
  merkleRoot: string
}

function hexToBytes(input: string): Uint8Array | null {
  const hex = input.startsWith('0x') || input.startsWith('0X') ? input.slice(2) : input
  if (hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
    return null
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

// canonicalDigest returns the exact bytes the generator's ECDSA signature is
// verified against: sha256 of the raw merkle-root bytes. Exported so tests and
// callers build the same commitment the signer used.
export function canonicalDigest(merkleRootHex: string): Uint8Array | null {
  const root = hexToBytes(merkleRootHex)
  if (!root || root.length === 0) return null
  return sha256(root)
}

// verifyBlockSignature returns true only when signatureValue is a valid
// secp256k1 ECDSA signature by identity over sha256(merkleRoot). Never throws.
export function verifyBlockSignature({
  identity,
  signatureValue,
  merkleRoot,
}: BlockSignatureInput): boolean {
  try {
    const pub = hexToBytes(identity)
    if (!pub || pub.length !== 33 || (pub[0] !== 0x02 && pub[0] !== 0x03)) {
      return false
    }
    const sigBytes = hexToBytes(signatureValue)
    if (!sigBytes || sigBytes.length === 0) return false
    const digest = canonicalDigest(merkleRoot)
    if (!digest) return false
    // fromDER rejects anything that is not a canonical DER ECDSA signature.
    const signature = secp256k1.Signature.fromDER(sigBytes)
    // lowS:false mirrors the Go/DefraDB verifier, which accepts either S value;
    // malleability is irrelevant here since we only count distinct verified
    // identities over the same root.
    return secp256k1.verify(signature, digest, pub, { lowS: false })
  } catch {
    return false
  }
}
