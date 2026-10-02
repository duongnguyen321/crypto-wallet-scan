import * as fs from "fs";
import * as path from "path";
import { GeneratedWallet } from "./walletGenerator";
import { WalletBalanceResult } from "./walletService";

export interface WalletHistoryEntry {
  timestamp: string;
  batchId: number;
  address: string;
  mnemonic: string;
  privateKey: string;
  wordCount: number;
  derivationPath: string;
  ethBalance: string;
  tokens: {
    symbol: string;
    balance: string;
    address: string;
  }[];
  hasPositiveBalance: boolean;
}

export class HistoryLogger {
  private logsDir: string;
  private sessionPrefix: string;
  private partIndex: number = 1;
  private currentLogFilePath: string = "";
  private writeStream: fs.WriteStream | null = null;
  private currentFileRecords: number = 0;
  private totalLogged: number = 0;
  private maxRecordsPerFile: number;

  constructor(customLogPath?: string, maxRecordsPerFile: number = 1000) {
    this.maxRecordsPerFile =
      maxRecordsPerFile > 0 ? maxRecordsPerFile : 1000;

    if (customLogPath) {
      this.logsDir = path.dirname(path.resolve(customLogPath));
      const ext = path.extname(customLogPath) || ".jsonl";
      const baseName = path.basename(customLogPath, ext);
      this.sessionPrefix = baseName;
    } else {
      this.logsDir = path.resolve(process.cwd(), "logs");
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      this.sessionPrefix = `history_${now.getFullYear()}-${pad(
        now.getMonth() + 1
      )}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(
        now.getMinutes()
      )}-${pad(now.getSeconds())}`;
    }

    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    this.openNextPart();
  }

  private openNextPart(): void {
    if (this.writeStream) {
      try {
        this.writeStream.end();
      } catch {
        // ignore
      }
    }

    this.currentLogFilePath = path.join(
      this.logsDir,
      `${this.sessionPrefix}_part${this.partIndex}.jsonl`
    );
    this.currentFileRecords = 0;

    this.writeStream = fs.createWriteStream(this.currentLogFilePath, {
      flags: "a",
      encoding: "utf-8",
    });
  }

  private rotateIfNeeded(incomingCount: number): void {
    if (
      this.currentFileRecords > 0 &&
      this.currentFileRecords + incomingCount > this.maxRecordsPerFile
    ) {
      this.partIndex++;
      this.openNextPart();
      console.log(
        `[INFO] Log rotation triggered: Created part ${this.partIndex} at ${this.currentLogFilePath}`
      );
    }
  }

  public getLogFilePath(): string {
    return this.currentLogFilePath;
  }

  public getSessionPattern(): string {
    return path.join(this.logsDir, `${this.sessionPrefix}_part*.jsonl`);
  }

  public getTotalLogged(): number {
    return this.totalLogged;
  }

  public getPartIndex(): number {
    return this.partIndex;
  }

  public getMaxRecordsPerFile(): number {
    return this.maxRecordsPerFile;
  }

  public logBatch(
    batchId: number,
    wallets: GeneratedWallet[],
    balances: WalletBalanceResult[]
  ): void {
    if (wallets.length === 0) return;

    this.rotateIfNeeded(wallets.length);

    if (!this.writeStream) return;

    const timestamp = new Date().toISOString();
    let buffer = "";

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      const balance = balances[i];

      const entry: WalletHistoryEntry = {
        timestamp,
        batchId,
        address: wallet.address,
        mnemonic: wallet.mnemonic,
        privateKey: wallet.privateKey,
        wordCount: wallet.wordCount,
        derivationPath: wallet.derivationPath,
        ethBalance: balance ? balance.ethBalance : "0.0",
        tokens: balance
          ? balance.tokens.map((t) => ({
              symbol: t.symbol,
              balance: t.balance,
              address: t.address,
            }))
          : [],
        hasPositiveBalance: balance ? balance.hasPositiveBalance : false,
      };

      buffer += JSON.stringify(entry) + "\n";
      this.totalLogged++;
      this.currentFileRecords++;
    }

    this.writeStream.write(buffer);
  }

  public logSingle(
    wallet: GeneratedWallet,
    balance: WalletBalanceResult
  ): void {
    this.rotateIfNeeded(1);

    if (!this.writeStream) return;

    const entry: WalletHistoryEntry = {
      timestamp: new Date().toISOString(),
      batchId: 0,
      address: wallet.address,
      mnemonic: wallet.mnemonic,
      privateKey: wallet.privateKey,
      wordCount: wallet.wordCount,
      derivationPath: wallet.derivationPath,
      ethBalance: balance.ethBalance,
      tokens: balance.tokens.map((t) => ({
        symbol: t.symbol,
        balance: t.balance,
        address: t.address,
      })),
      hasPositiveBalance: balance.hasPositiveBalance,
    };

    this.writeStream.write(JSON.stringify(entry) + "\n");
    this.totalLogged++;
    this.currentFileRecords++;
  }

  public async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.writeStream) {
        this.writeStream.end(() => {
          this.writeStream = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
