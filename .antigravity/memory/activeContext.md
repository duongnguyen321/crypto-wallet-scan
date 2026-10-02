# Active Context

## Current Goal
Implement modular wallet service, wallet generator from `seed.txt`, and infinite loop batch scanner saving matches to `found.json`.

## Immediate Tasks
1. Create `walletService.ts` with Multicall3 support and single/batch balance lookup.
2. Create `walletGenerator.ts` to generate 12/24 word BIP-39 wallets from `seed.txt`.
3. Update `index.ts` to orchestrate continuous batches of 12 wallets and save matches to `found.json`.
4. Validate implementation with test run.
