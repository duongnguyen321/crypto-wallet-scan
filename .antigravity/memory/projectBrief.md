# Project Brief: Auto Wallet Checker

## Objective
Develop a high-performance wallet generator and balance checking service that runs in an infinite loop, processing batches of 12 wallets at a time.

## Requirements
- Refactor balance checking logic into a modular service (`walletService.ts`).
- Create a dedicated generator service (`walletGenerator.ts`) to generate valid 12-word and 24-word BIP-39 mnemonics using `seed.txt`.
- Support batch checking of 12 wallets per iteration using Multicall3 for optimal RPC efficiency.
- Save wallets with positive balance (> 0 ETH or ERC-20 tokens) into `found.json`.
- Run continuously in an infinite loop with configurable delay between batches.
- No emoji icons in terminal logs, code, or data output.
