# Progress Log

## Work Done
- Implemented Automatic Log Rotation:
  - Updated `src/services/historyLogger.ts` to automatically split history logs into parts (`_part1.jsonl`, `_part2.jsonl`, `_part3.jsonl`...).
  - Default rotation limit: 1,000 wallets per file (can be customized via `--split <number>` or env `MAX_LOG_RECORDS`).
- Added `.gitignore`:
  - Ignored `node_modules/`, `logs/`, `*.jsonl`, `found.json` (prevents leaking private keys/mnemonics), `.env` files, build artifacts, and OS files (`.DS_Store`).
- Added comprehensive documentation (`README.md`):
  - Detailed overview explaining what the project is (BIP-39 mnemonic generator, MetaMask derivation, Multicall3 batching).
  - Explicit use cases (wallet recovery, batch balance inspection, single mnemonic audit, security research).
  - Full CLI flag guide, environment variable reference, output schemas (`found.json` and `logs/`), and examples.
