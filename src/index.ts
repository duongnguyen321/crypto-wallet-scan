import * as fs from "fs";
import * as path from "path";
import { WalletGenerator, GeneratedWallet, WordCountMode } from "./services/walletGenerator";
import {
  WalletService,
  WalletBalanceResult,
  resolveTokens,
} from "./services/walletService";
import { HistoryLogger } from "./services/historyLogger";

interface CliOptions {
  wordsMode: WordCountMode;
  tokensInput: string | undefined;
  batchSize: number;
  delayMs: number;
  maxLogRecords: number;
  rpcUrl?: string;
  outputFile: string;
  positionalArgs: string[];
  showHelp: boolean;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);

  // Defaults from env or standard defaults
  let envWords: WordCountMode = 12;
  const rawEnvWords = (process.env.SEED_WORDS || "").trim().toLowerCase();
  if (rawEnvWords === "24") envWords = 24;
  else if (rawEnvWords === "all" || rawEnvWords === "random") envWords = "all";

  let wordsMode: WordCountMode = envWords;
  let tokensInput: string | undefined = process.env.SCAN_TOKENS;
  let batchSize = parseInt(process.env.BATCH_SIZE || "12", 10);
  let delayMs = parseInt(process.env.DELAY_MS || "500", 10);
  let maxLogRecords = parseInt(process.env.MAX_LOG_RECORDS || "1000", 10);
  let rpcUrl = process.env.RPC_URL;
  let outputFile = process.env.OUTPUT_FILE || path.join(process.cwd(), "found.json");
  let showHelp = false;
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      showHelp = true;
    } else if (arg === "--words" || arg === "-w") {
      const val = (args[++i] || "").toLowerCase();
      if (val === "24") wordsMode = 24;
      else if (val === "all" || val === "random") wordsMode = "all";
      else wordsMode = 12;
    } else if (arg.startsWith("--words=")) {
      const val = arg.split("=")[1].toLowerCase();
      if (val === "24") wordsMode = 24;
      else if (val === "all" || val === "random") wordsMode = "all";
      else wordsMode = 12;
    } else if (arg === "--tokens" || arg === "-t") {
      tokensInput = args[++i];
    } else if (arg.startsWith("--tokens=")) {
      tokensInput = arg.split("=")[1];
    } else if (arg === "--eth-only") {
      tokensInput = "none";
    } else if (arg === "--batch" || arg === "-b") {
      batchSize = parseInt(args[++i], 10);
    } else if (arg.startsWith("--batch=")) {
      batchSize = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--delay" || arg === "-d") {
      delayMs = parseInt(args[++i], 10);
    } else if (arg.startsWith("--delay=")) {
      delayMs = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--split" || arg === "--max-log-records") {
      maxLogRecords = parseInt(args[++i], 10);
    } else if (arg.startsWith("--split=")) {
      maxLogRecords = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--max-log-records=")) {
      maxLogRecords = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--rpc") {
      rpcUrl = args[++i];
    } else if (arg.startsWith("--rpc=")) {
      rpcUrl = arg.split("=")[1];
    } else if (arg === "--output" || arg === "-o") {
      outputFile = args[++i];
    } else if (arg.startsWith("--output=")) {
      outputFile = arg.split("=")[1];
    } else if (!arg.startsWith("-")) {
      positionalArgs.push(arg);
    }
  }

  return {
    wordsMode,
    tokensInput,
    batchSize: isNaN(batchSize) || batchSize <= 0 ? 12 : batchSize,
    delayMs: isNaN(delayMs) || delayMs < 0 ? 500 : delayMs,
    maxLogRecords: isNaN(maxLogRecords) || maxLogRecords <= 0 ? 1000 : maxLogRecords,
    rpcUrl,
    outputFile,
    positionalArgs,
    showHelp,
  };
}

function printUsage() {
  console.log(`
Usage:
  bun run start [flags]
  bun run dev [flags]
  bun src/index.ts "word1 word2 ... word12" (check a single wallet)

Flags:
  -w, --words <12|24|all>        Seed phrase length (default: 12)
  -t, --tokens <list>            Tokens to scan, e.g. "USDT,USDC", "USDT", "none", "all"
                                 (default: USDT,USDC)
      --eth-only                 Scan only ETH balance (skips all ERC20 tokens for max speed)
  -b, --batch <number>           Batch size per iteration (default: 12)
  -d, --delay <ms>               Delay between batches in ms (default: 500)
      --split <number>           Auto-split log file after N wallets (default: 1000)
      --rpc <url>                Custom Ethereum RPC node URL
  -o, --output <file>            File path to save wallets with positive balance (default: found.json)
  -h, --help                     Show this help message

Environment Variables:
  SEED_WORDS                     12, 24, or all (default: 12)
  SCAN_TOKENS                    Comma-separated list (e.g. USDT, none, all)
  BATCH_SIZE                     Batch size (default: 12)
  DELAY_MS                       Delay in milliseconds (default: 500)
  MAX_LOG_RECORDS                Max wallets per log file part before rotating (default: 1000)
  RPC_URL                        RPC endpoint URL
  OUTPUT_FILE                    Output JSON file path (default: found.json)
`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveFoundWallet(
  wallet: GeneratedWallet,
  balance: WalletBalanceResult,
  filePath: string
): void {
  let records: unknown[] = [];
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        records = parsed;
      }
    } catch {
      records = [];
    }
  }

  const positiveTokens = balance.tokens
    .filter((t) => t.raw > 0n)
    .map((t) => ({
      symbol: t.symbol,
      balance: t.balance,
      address: t.address,
    }));

  const item = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic,
    wordCount: wallet.wordCount,
    derivationPath: wallet.derivationPath,
    foundAt: new Date().toISOString(),
    balances: {
      eth: balance.ethBalance,
      tokens: positiveTokens,
    },
  };

  records.push(item);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), "utf-8");
}

async function checkSingleMnemonic(
  phrase: string,
  service: WalletService,
  generator: WalletGenerator,
  logger: HistoryLogger,
  outputFile: string
) {
  console.log("[INFO] Checking single wallet from input mnemonic...");
  const wallet = generator.fromMnemonic(phrase);
  console.log(`[INFO] Address: ${wallet.address}`);
  console.log(`[INFO] Path: ${wallet.derivationPath}`);

  const balance = await service.getWalletBalance(wallet.address);
  console.log(`[INFO] ETH Balance: ${balance.ethBalance} ETH`);
  if (balance.tokens.length > 0) {
    console.log("[INFO] ERC20 Tokens:");
    for (const token of balance.tokens) {
      console.log(`  - ${token.symbol}: ${token.balance}`);
    }
  }

  logger.logSingle(wallet, balance);
  await logger.close();

  if (balance.hasPositiveBalance) {
    console.log("[FOUND] Wallet has positive balance! Saving to " + outputFile);
    saveFoundWallet(wallet, balance, outputFile);
  } else {
    console.log("[INFO] Wallet balance is zero.");
  }
}

async function runInfiniteScanner(
  service: WalletService,
  generator: WalletGenerator,
  logger: HistoryLogger,
  options: CliOptions
) {
  const activeTokens = service.getActiveTokens();
  const tokenNames =
    activeTokens.length > 0
      ? `ETH, ${activeTokens.map((t) => t.symbol).join(", ")}`
      : "ETH Only (ERC20 tokens disabled)";

  const wordsDisplay =
    options.wordsMode === 24
      ? "24 words"
      : options.wordsMode === "all"
      ? "Random mix (12 & 24 words)"
      : "12 words (default)";

  console.log("==================================================");
  console.log("AUTO WALLET SCANNER - MULTICALL3 BATCH MODE");
  console.log(`Word Mode    : ${wordsDisplay}`);
  console.log(`Scan Assets  : ${tokenNames}`);
  console.log(`Batch Size   : ${options.batchSize} wallets/batch`);
  console.log(`Batch Delay  : ${options.delayMs} ms`);
  console.log(`RPC Node     : ${service.getActiveRpc()}`);
  console.log(`Found File   : ${options.outputFile}`);
  console.log(
    `History File : ${logger.getLogFilePath()} (split every ${logger.getMaxRecordsPerFile()} wallets)`
  );
  console.log(`Seed Wordlist: ${generator.getWordCount()} words loaded`);
  console.log("==================================================");

  let batchCount = 0;
  let totalChecked = 0;
  let foundCount = 0;
  const startTime = Date.now();

  const handleShutdown = async () => {
    const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const speed = (totalChecked / elapsedSec).toFixed(1);
    await logger.close();

    console.log("\n==================================================");
    console.log("SCANNER SHUTDOWN SUMMARY");
    console.log(`Word Mode     : ${wordsDisplay}`);
    console.log(`Total Batches : ${batchCount}`);
    console.log(`Total Checked : ${totalChecked}`);
    console.log(`Wallets Found : ${foundCount}`);
    console.log(`History Logged: ${logger.getTotalLogged()} entries`);
    console.log(`History Parts : ${logger.getPartIndex()} files created`);
    console.log(`History Pattern: ${logger.getSessionPattern()}`);
    console.log(`Elapsed Time  : ${elapsedSec}s (${speed} wallets/s)`);
    console.log("==================================================");
    process.exit(0);
  };

  process.on("SIGINT", () => {
    handleShutdown().catch(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    handleShutdown().catch(() => process.exit(0));
  });

  while (true) {
    batchCount++;
    const batchStart = Date.now();

    // 1. Generate batch of wallets according to configured wordsMode (default: 12 words)
    const wallets = generator.generateBatch(options.batchSize, options.wordsMode);
    const addresses = wallets.map((w) => w.address);

    try {
      // 2. Query batch balances via Multicall3 in 1 single RPC request
      const balances = await service.getBatchBalances(addresses);
      totalChecked += wallets.length;

      // 3. Log full detailed history to jsonl stream (auto-splits when reaching maxRecordsPerFile)
      logger.logBatch(batchCount, wallets, balances);

      // 4. Inspect balances for positive matches
      for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const balance = balances[i];

        if (balance && balance.hasPositiveBalance) {
          foundCount++;
          console.log("\n**************************************************");
          console.log("[FOUND] POSITIVE BALANCE DETECTED!");
          console.log(`Address : ${wallet.address}`);
          console.log(`Phrase  : ${wallet.mnemonic}`);
          console.log(`Words   : ${wallet.wordCount}`);
          console.log(`ETH     : ${balance.ethBalance}`);
          const positiveTokens = balance.tokens.filter((t) => t.raw > 0n);
          for (const token of positiveTokens) {
            console.log(`Token   : ${token.symbol} = ${token.balance}`);
          }
          console.log("**************************************************\n");

          saveFoundWallet(wallet, balance, options.outputFile);
        }
      }

      const batchDuration = Date.now() - batchStart;
      const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const speed = (totalChecked / elapsedSec).toFixed(1);

      console.log(
        `[BATCH #${batchCount}] Checked: ${wallets.length} | Total: ${totalChecked} | Found: ${foundCount} | Part: #${logger.getPartIndex()} | Speed: ${speed} w/s | Time: ${batchDuration}ms`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ERROR] Batch #${batchCount} encountered error: ${msg}`);
    }

    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }
}

async function main() {
  const options = parseCliArgs();

  if (options.showHelp) {
    printUsage();
    process.exit(0);
  }

  const generator = new WalletGenerator();
  const configuredTokens = resolveTokens(options.tokensInput);
  const rpcList = options.rpcUrl ? [options.rpcUrl] : undefined;
  const service = new WalletService(rpcList, configuredTokens);
  const logger = new HistoryLogger(process.env.HISTORY_FILE, options.maxLogRecords);

  if (options.positionalArgs.length > 0) {
    const phrase = options.positionalArgs.join(" ").trim();
    await checkSingleMnemonic(phrase, service, generator, logger, options.outputFile);
  } else {
    await runInfiniteScanner(service, generator, logger, options);
  }
}

main().catch((err) => {
  console.error("[FATAL] Application crashed:", err);
  process.exit(1);
});
