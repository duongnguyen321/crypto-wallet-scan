# Crypto Wallet Scan

High-performance Ethereum and EVM wallet scanner and balance inspection tool using BIP-39 mnemonic seed phrases and Multicall3 contract batching.

## Overview: What is this?

Crypto Wallet Scan is a high-throughput CLI tool built with TypeScript, ethers.js v6, and Bun/Node.js. It generates cryptographically valid BIP-39 seed phrases (12-word, 24-word, or mixed), derives the standard MetaMask / Ethereum wallet address (`m/44'/60'/0'/0/0`), and checks both native ETH and ERC-20 token balances in real time.

Instead of making individual network requests for each wallet and token, it bundles all checks into batches using the canonical Ethereum Multicall3 smart contract (`0xcA11bde05977b3631167028862bE2a173976CA11`). This allows querying dozens of wallets and multiple tokens in a single RPC round-trip.

When a wallet with a balance greater than zero is detected, it is immediately recorded to `found.json` with its address, private key, mnemonic phrase, and balance breakdown.

## Purpose: What is it used for?

- **Wallet Recovery and Auditing**: Scan or verify mnemonic phrases to discover forgotten wallets or check for remaining assets across Ethereum.
- **High-Efficiency Batch Balance Checking**: Inspect large batches of addresses for ETH and popular ERC-20 tokens simultaneously without hitting RPC rate limits.
- **Single Mnemonic Inspection**: Instantly verify the balance and derivation details of any 12 or 24-word seed phrase directly from the terminal.
- **Cryptographic and Security Research**: Study BIP-39 entropy distribution, key derivation pipelines, and on-chain querying performance.

## Key Features

- **Multicall3 Batch Queries**: Checks 12 wallets (or custom batch sizes) for native ETH and ERC-20 balances in 1 single RPC request.
- **12 and 24-Word Seed Support**: Generate and check standard 12-word phrases, 24-word phrases, or a random combination of both.
- **Built-in Token Registry**: Pre-configured support for 15 major ERC-20 tokens: USDT, USDC, WETH, WBTC, DAI, LINK, UNI, AAVE, PEPE, SHIB, FLOKI, LDO, CRV, GRT, and 1INCH.
- **Custom Token Support**: Add any ERC-20 token on the fly via symbol, contract address, and decimals.
- **ETH-Only High-Speed Mode**: Option to bypass token contracts and query purely native ETH for maximum throughput.
- **Automatic RPC Failover**: Rotates through backup RPC endpoints automatically when rate limits or network errors occur.
- **Streaming Log Rotation**: Writes audit logs in JSON Lines format (`.jsonl`) and automatically rotates log files after a configurable threshold (default: 1,000 wallets per file) to keep file sizes manageable.
- **Clean CLI Output**: Formatted console logging with speed metrics (wallets/sec), batch execution times, and zero emoji clutter.

## Prerequisites

- **Runtime**: Bun (recommended) or Node.js (v18 or higher)
- **Wordlist**: `seed.txt` containing 2048 BIP-39 English words in the project root directory (included in repository)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/duongnguyen321/crypto-wallet-scan.git
cd crypto-wallet-scan
```

Using Bun:
```bash
bun install
```

Using npm:
```bash
npm install
```

## How to Use

### 1. Default Continuous Scanner

Runs an infinite loop scanning 12-word seed phrases, checking ETH, USDT, and USDC balances in batches of 12 wallets:

```bash
# Using Bun
bun run dev

# Using npm
npm start
```

### 2. Scanning 24-Word Seed Phrases

```bash
bun run dev --words 24
```

### 3. Mixed Mode (12 and 24 Words)

Randomly alternates between 12-word and 24-word seed phrases:

```bash
bun run dev --words all
```

### 4. ETH-Only Mode (Maximum Speed)

Skips token checks entirely to maximize scanning rate:

```bash
bun run dev --eth-only
```

### 5. Scanning Specific or All Predefined Tokens

Scan only specific tokens:
```bash
bun run dev --tokens USDT,USDC,PEPE
```

Scan all 15 built-in tokens:
```bash
bun run dev --tokens all
```

Add a custom ERC-20 token by contract address:
```bash
bun run dev --tokens "MYTOKEN:0x1234567890abcdef1234567890abcdef12345678:18"
```

### 6. Adjusting Batch Size and Delay

```bash
bun run dev --batch 24 --delay 250
```

### 7. Custom RPC Endpoint

```bash
bun run dev --rpc https://eth.llamarpc.com
```

### 8. Custom Log Rotation Size

Split log files after every 5,000 wallets:

```bash
bun run dev --split 5000
```

### 9. Check a Single Mnemonic Phrase

Verify the balance of a specific known seed phrase:

```bash
bun src/index.ts "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
```

## Command-Line Options Reference

| Flag | Shorthand | Description | Default |
| --- | --- | --- | --- |
| `--words <12\|24\|all>` | `-w` | Seed phrase length to generate | `12` |
| `--tokens <list>` | `-t` | Comma-separated list of tokens (`USDT,USDC`, `all`, `none`) | `USDT,USDC` |
| `--eth-only` | | Check only native ETH (disables token checks) | `false` |
| `--batch <number>` | `-b` | Number of wallets per Multicall3 batch | `12` |
| `--delay <ms>` | `-d` | Pause between batches in milliseconds | `500` |
| `--split <number>` | | Number of wallets before rotating log file | `1000` |
| `--rpc <url>` | | Custom Ethereum RPC provider URL | Public endpoints |
| `--output <file>` | `-o` | Output file for wallets with positive balances | `found.json` |
| `--help` | `-h` | Display usage instructions and available flags | |

## Environment Variables

All parameters can also be configured via environment variables or a `.env` file:

```env
SEED_WORDS=12
SCAN_TOKENS=USDT,USDC
BATCH_SIZE=12
DELAY_MS=500
MAX_LOG_RECORDS=1000
RPC_URL=https://ethereum-rpc.publicnode.com
OUTPUT_FILE=found.json
```

## Output Data

### Found Wallets (`found.json`)

When a wallet with a balance greater than zero is detected, it is saved into `found.json`:

```json
[
  {
    "address": "0x1234...5678",
    "privateKey": "0xabc...def",
    "mnemonic": "word1 word2 ... word12",
    "wordCount": 12,
    "derivationPath": "m/44'/60'/0'/0/0",
    "foundAt": "2026-10-02T04:00:00.000Z",
    "balances": {
      "eth": "0.05",
      "tokens": [
        {
          "symbol": "USDT",
          "balance": "100.0",
          "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        }
      ]
    }
  }
]
```

### Full Audit History (`logs/`)

Every wallet checked is streamed to `logs/history_<date>_<time>_part<N>.jsonl`. When the record limit (`--split` or `MAX_LOG_RECORDS`) is reached, a new part file is automatically created.

## Project Structure

```
crypto-wallet-scan/
├── .antigravity/            # Workspace memory and guidelines
├── logs/                    # Output directory for rotated scan histories (.jsonl)
├── src/
│   ├── services/
│   │   ├── historyLogger.ts # Streaming JSONL logger with automatic file rotation
│   │   ├── walletGenerator.ts # BIP-39 mnemonic generator (12/24 words)
│   │   └── walletService.ts   # Multicall3 batch balance checker and RPC manager
│   └── index.ts             # CLI entrypoint and main scanning loop
├── .gitignore
├── found.json               # Auto-created file for discovered positive-balance wallets
├── package.json
├── seed.txt                 # BIP-39 standard 2048 English wordlist
└── tsconfig.json
```

## Security and Disclaimer

This project is created for educational, research, and recovery purposes. Never commit real private keys or mnemonic phrases to version control. The `.gitignore` file is pre-configured to exclude `found.json`, `logs/`, and environment configuration files.
