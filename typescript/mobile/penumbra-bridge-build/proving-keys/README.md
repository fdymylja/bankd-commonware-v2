# Proving Keys

These binary files are required to build ZK proofs for Penumbra transactions (spend, output actions).

Copy from `admin/public/proving-keys/`:

```bash
cp ../../../admin/public/proving-keys/{spend_pk,output_pk}.bin .
```

They are inlined as base64 into the bridge HTML during the Vite build.
