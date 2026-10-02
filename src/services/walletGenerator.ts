import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

export type WordCountMode = 12 | 24 | "all" | "random";

export interface GeneratedWallet {
  address: string;
  mnemonic: string;
  privateKey: string;
  wordCount: number;
  derivationPath: string;
}

export class WalletGenerator {
  private wordlist: ethers.Wordlist;
  private seedWords: string[];
  public static readonly DEFAULT_DERIVATION_PATH = "m/44'/60'/0'/0/0";

  constructor(customSeedPath?: string) {
    const resolvedPath = this.resolveSeedPath(customSeedPath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      throw new Error(
        `[ERROR] Seed file not found. Checked: ${
          customSeedPath || "root and relative paths"
        }`
      );
    }

    const content = fs.readFileSync(resolvedPath, "utf-8");
    this.seedWords = content
      .split(/\r?\n/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    if (this.seedWords.length !== 2048) {
      throw new Error(
        `[ERROR] Seed file must contain exactly 2048 BIP-39 words, but found ${this.seedWords.length}.`
      );
    }

    this.wordlist = ethers.wordlists.en;
  }

  private resolveSeedPath(customPath?: string): string | null {
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }

    const candidates = [
      path.resolve(process.cwd(), "seed.txt"),
      path.resolve(__dirname, "../../seed.txt"),
      path.resolve(__dirname, "../seed.txt"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  public getWordCount(): number {
    return this.seedWords.length;
  }

  public generateWallet(
    wordCount: WordCountMode = 12,
    derivationPath: string = WalletGenerator.DEFAULT_DERIVATION_PATH
  ): GeneratedWallet {
    let selectedCount: 12 | 24 = 12;
    if (wordCount === 24) {
      selectedCount = 24;
    } else if (wordCount === "all" || wordCount === "random") {
      selectedCount = Math.random() < 0.5 ? 12 : 24;
    } else {
      selectedCount = 12;
    }

    const entropyBytes = selectedCount === 12 ? 16 : 32;
    const entropy = ethers.randomBytes(entropyBytes);

    const mnemonicObj = ethers.Mnemonic.fromEntropy(entropy, null, this.wordlist);
    const hdWallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, derivationPath);

    return {
      address: hdWallet.address,
      mnemonic: mnemonicObj.phrase,
      privateKey: hdWallet.privateKey,
      wordCount: selectedCount,
      derivationPath,
    };
  }

  public generateBatch(
    count: number = 12,
    wordCount: WordCountMode = 12,
    derivationPath: string = WalletGenerator.DEFAULT_DERIVATION_PATH
  ): GeneratedWallet[] {
    const wallets: GeneratedWallet[] = [];
    for (let i = 0; i < count; i++) {
      wallets.push(this.generateWallet(wordCount, derivationPath));
    }
    return wallets;
  }

  public fromMnemonic(
    phrase: string,
    derivationPath: string = WalletGenerator.DEFAULT_DERIVATION_PATH
  ): GeneratedWallet {
    const cleanPhrase = phrase.trim();
    if (!ethers.Mnemonic.isValidMnemonic(cleanPhrase, this.wordlist)) {
      throw new Error("[ERROR] Invalid BIP-39 mnemonic phrase.");
    }

    const mnemonicObj = ethers.Mnemonic.fromPhrase(cleanPhrase, null, this.wordlist);
    const hdWallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, derivationPath);
    const words = cleanPhrase.split(/\s+/);

    return {
      address: hdWallet.address,
      mnemonic: mnemonicObj.phrase,
      privateKey: hdWallet.privateKey,
      wordCount: words.length,
      derivationPath,
    };
  }
}
