# Tech Context

## Tech Stack
- Runtime: Bun / Node.js
- Language: TypeScript (`tsc`, `tsx`)
- Web3: ethers.js v6 (`ethers@6.17.0`)
- Contracts:
  - Multicall3: `0xcA11bde05977b3631167028862bE2a173976CA11`
  - Predefined Tokens (15): USDT, USDC, WETH, WBTC, DAI, LINK, UNI, AAVE, PEPE, SHIB, FLOKI, LDO, CRV, GRT, 1INCH.
- Constraints:
  - Strictly NO emojis in console logs or code.
  - Efficient batch querying with Multicall3 to avoid RPC 429 rate limits.
