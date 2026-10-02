import { ethers } from "ethers";

export interface TokenConfig {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
}

export interface TokenBalance {
  name: string;
  symbol: string;
  address: string;
  balance: string;
  raw: bigint;
  decimals: number;
}

export interface WalletBalanceResult {
  address: string;
  ethBalance: string;
  ethRaw: bigint;
  tokens: TokenBalance[];
  hasPositiveBalance: boolean;
}

const DEFAULT_RPCS = [
  process.env.RPC_URL,
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
  "https://eth-mainnet.public.blastapi.io",
].filter((url): url is string => Boolean(url && url.trim().length > 0));

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[])",
  "function getEthBalance(address addr) view returns (uint256 balance)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export const KNOWN_TOKENS: Record<string, TokenConfig> = {
  USDT: {
    name: "Tether USD",
    symbol: "USDT",
    address: ethers.getAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7".toLowerCase()),
    decimals: 6,
  },
  USDC: {
    name: "USD Coin",
    symbol: "USDC",
    address: ethers.getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".toLowerCase()),
    decimals: 6,
  },
  WETH: {
    name: "Wrapped Ether",
    symbol: "WETH",
    address: ethers.getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase()),
    decimals: 18,
  },
  WBTC: {
    name: "Wrapped BTC",
    symbol: "WBTC",
    address: ethers.getAddress("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599".toLowerCase()),
    decimals: 8,
  },
  DAI: {
    name: "Dai Stablecoin",
    symbol: "DAI",
    address: ethers.getAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F".toLowerCase()),
    decimals: 18,
  },
  LINK: {
    name: "ChainLink Token",
    symbol: "LINK",
    address: ethers.getAddress("0x514910771AF9Ca656af840dff83E8264EcF986CA".toLowerCase()),
    decimals: 18,
  },
  UNI: {
    name: "Uniswap",
    symbol: "UNI",
    address: ethers.getAddress("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984".toLowerCase()),
    decimals: 18,
  },
  AAVE: {
    name: "Aave Token",
    symbol: "AAVE",
    address: ethers.getAddress("0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9".toLowerCase()),
    decimals: 18,
  },
  PEPE: {
    name: "Pepe",
    symbol: "PEPE",
    address: ethers.getAddress("0x6982508145454Ce325dDbE47a25d4ec3d2311933".toLowerCase()),
    decimals: 18,
  },
  SHIB: {
    name: "SHIBA INU",
    symbol: "SHIB",
    address: ethers.getAddress("0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE".toLowerCase()),
    decimals: 18,
  },
  FLOKI: {
    name: "FLOKI",
    symbol: "FLOKI",
    address: ethers.getAddress("0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E".toLowerCase()),
    decimals: 9,
  },
  LDO: {
    name: "Lido DAO Token",
    symbol: "LDO",
    address: ethers.getAddress("0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32".toLowerCase()),
    decimals: 18,
  },
  CRV: {
    name: "Curve DAO Token",
    symbol: "CRV",
    address: ethers.getAddress("0xD533a949740bb3306d119CC777fa900bA034cd52".toLowerCase()),
    decimals: 18,
  },
  GRT: {
    name: "Graph Token",
    symbol: "GRT",
    address: ethers.getAddress("0xc944E90C64B2c07662A292be6244BDf05Cda44a7".toLowerCase()),
    decimals: 18,
  },
  "1INCH": {
    name: "1INCH Token",
    symbol: "1INCH",
    address: ethers.getAddress("0x111111111117dC0aa78b770fA6A738034120C302".toLowerCase()),
    decimals: 18,
  },
};

export function resolveTokens(tokenInput?: string): TokenConfig[] {
  if (tokenInput === undefined) {
    return [KNOWN_TOKENS.USDT, KNOWN_TOKENS.USDC];
  }

  const normalized = tokenInput.trim().toLowerCase();
  if (
    normalized === "none" ||
    normalized === "false" ||
    normalized === "0" ||
    normalized === "eth" ||
    normalized === "eth-only"
  ) {
    return [];
  }

  if (normalized === "all") {
    return Object.values(KNOWN_TOKENS);
  }

  const requested = tokenInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const resolved: TokenConfig[] = [];

  for (const item of requested) {
    const upper = item.toUpperCase();
    if (KNOWN_TOKENS[upper]) {
      resolved.push(KNOWN_TOKENS[upper]);
    } else if (item.includes(":")) {
      const parts = item.split(":");
      if (parts.length >= 2) {
        try {
          resolved.push({
            name: parts[0],
            symbol: parts[0].toUpperCase(),
            address: ethers.getAddress(parts[1].toLowerCase()),
            decimals: parts[2] ? parseInt(parts[2], 10) : 18,
          });
        } catch {
          console.warn(`[WARN] Invalid token address format for ${item}`);
        }
      }
    } else {
      console.warn(
        `[WARN] Unknown token symbol: "${item}". Available: ${Object.keys(KNOWN_TOKENS).join(", ")}, none, all`
      );
    }
  }

  return resolved;
}

export class WalletService {
  private rpcUrls: string[];
  private currentRpcIndex: number = 0;
  private provider: ethers.JsonRpcProvider;
  private multicallContract: ethers.Contract;
  private erc20Interface: ethers.Interface;
  private tokens: TokenConfig[];

  constructor(
    rpcUrls: string[] = DEFAULT_RPCS,
    tokens: TokenConfig[] = [KNOWN_TOKENS.USDT, KNOWN_TOKENS.USDC]
  ) {
    this.rpcUrls = rpcUrls.length > 0 ? rpcUrls : ["https://ethereum-rpc.publicnode.com"];
    this.tokens = tokens;
    this.erc20Interface = new ethers.Interface(ERC20_ABI);
    this.provider = this.createProvider(this.rpcUrls[0]);
    this.multicallContract = new ethers.Contract(
      MULTICALL3_ADDRESS,
      MULTICALL3_ABI,
      this.provider
    );
  }

  private createProvider(url: string): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(url, undefined, {
      staticNetwork: ethers.Network.from(1),
    });
  }

  private rotateRpc(): void {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
    const nextRpc = this.rpcUrls[this.currentRpcIndex];
    console.warn(`[WARN] RPC failover triggered. Switching to RPC: ${nextRpc}`);
    this.provider = this.createProvider(nextRpc);
    this.multicallContract = new ethers.Contract(
      MULTICALL3_ADDRESS,
      MULTICALL3_ABI,
      this.provider
    );
  }

  public getActiveRpc(): string {
    return this.rpcUrls[this.currentRpcIndex];
  }

  public getActiveTokens(): TokenConfig[] {
    return this.tokens;
  }

  public async getBatchBalances(
    addresses: string[]
  ): Promise<WalletBalanceResult[]> {
    if (addresses.length === 0) return [];

    const checksummedAddresses = addresses.map((addr) =>
      ethers.getAddress(addr.toLowerCase())
    );

    const calls: { target: string; allowFailure: boolean; callData: string }[] = [];

    for (const addr of checksummedAddresses) {
      // 1. ETH balance call via Multicall3
      calls.push({
        target: MULTICALL3_ADDRESS,
        allowFailure: true,
        callData: this.multicallContract.interface.encodeFunctionData(
          "getEthBalance",
          [addr]
        ),
      });

      // 2. Token balance calls (if any configured)
      for (const token of this.tokens) {
        calls.push({
          target: token.address,
          allowFailure: true,
          callData: this.erc20Interface.encodeFunctionData("balanceOf", [addr]),
        });
      }
    }

    let rawResults: { success: boolean; returnData: string }[] = [];
    let attempts = 0;
    const maxAttempts = this.rpcUrls.length * 2;

    while (attempts < maxAttempts) {
      try {
        rawResults = await this.multicallContract.aggregate3.staticCall(calls);
        break;
      } catch (err: unknown) {
        attempts++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(
          `[ERROR] Multicall aggregate3 failed on ${this.getActiveRpc()}: ${errorMessage}`
        );
        this.rotateRpc();
        if (attempts >= maxAttempts) {
          throw new Error(`[FATAL] All RPC endpoints failed after ${attempts} attempts.`);
        }
      }
    }

    const itemsPerWallet = 1 + this.tokens.length;
    const results: WalletBalanceResult[] = [];

    for (let i = 0; i < checksummedAddresses.length; i++) {
      const addr = checksummedAddresses[i];
      const baseIdx = i * itemsPerWallet;

      // ETH balance
      const ethRes = rawResults[baseIdx];
      let ethRaw = 0n;
      if (ethRes && ethRes.success && ethRes.returnData && ethRes.returnData !== "0x") {
        try {
          ethRaw = this.multicallContract.interface.decodeFunctionResult(
            "getEthBalance",
            ethRes.returnData
          )[0];
        } catch {
          ethRaw = 0n;
        }
      }

      // Token balances
      const tokenBalances: TokenBalance[] = [];
      let hasTokenBalance = false;

      for (let t = 0; t < this.tokens.length; t++) {
        const token = this.tokens[t];
        const tokenRes = rawResults[baseIdx + 1 + t];
        let rawBalance = 0n;

        if (tokenRes && tokenRes.success && tokenRes.returnData && tokenRes.returnData !== "0x") {
          try {
            rawBalance = this.erc20Interface.decodeFunctionResult(
              "balanceOf",
              tokenRes.returnData
            )[0];
          } catch {
            rawBalance = 0n;
          }
        }

        if (rawBalance > 0n) {
          hasTokenBalance = true;
        }

        tokenBalances.push({
          name: token.name,
          symbol: token.symbol,
          address: token.address,
          balance: ethers.formatUnits(rawBalance, token.decimals),
          raw: rawBalance,
          decimals: token.decimals,
        });
      }

      const hasPositiveBalance = ethRaw > 0n || hasTokenBalance;

      results.push({
        address: addr,
        ethBalance: ethers.formatEther(ethRaw),
        ethRaw,
        tokens: tokenBalances,
        hasPositiveBalance,
      });
    }

    return results;
  }

  public async getWalletBalance(address: string): Promise<WalletBalanceResult> {
    const results = await this.getBatchBalances([address]);
    return results[0];
  }
}
