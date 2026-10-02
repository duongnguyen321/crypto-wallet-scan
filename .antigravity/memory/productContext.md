# Product Context

## Problem Space
Automated blockchain wallet inspection for discovering wallets with remaining balances or activity.

## Use Cases
- Generate random valid 12-word or 24-word seed phrases using BIP-39 wordlist.
- Check Ethereum native balance (ETH) and ERC-20 token balances (USDT, USDC, and extendable to other tokens).
- Group queries into batches of 12 wallets using Ethereum Multicall3 contract (`0xcA11bde05977b3631167028862bE2a173976CA11`) to execute all balance checks in a single RPC call.
- Persist discovered wallets with positive balance to `found.json`.
- Provide clean CLI logging without emojis.
