# System Patterns & Architecture

## Architecture
- `src/` Folder Structure:
  - `src/index.ts`: Main entry point and infinite loop runner.
  - `src/services/walletService.ts`: Multicall3 batch querying for 12 wallets in 1 RPC round-trip. RPC failover and retry logic.
  - `src/services/walletGenerator.ts`: Generates 12 & 24-word BIP-39 wallets from `seed.txt` with proper BIP-39 checksums.
- Persistence:
  - `found.json`: Automatically created/appended when a wallet has balance > 0 (ETH, USDT, USDC).
- Configuration:
  - `package.json` scripts: `start` (`tsx src/index.ts`), `dev` (`bun run src/index.ts`), `typecheck` (`tsc --noEmit`).
  - `tsconfig.json`: Configured for `"src/**/*"`.
