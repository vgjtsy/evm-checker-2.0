import { ethers } from "ethers";
import { MULTICALL3_ABI } from "../types";
import { SETTINGS } from "../config/settings";

export interface Call3 {
  target: string;
  allowFailure: boolean;
  callData: string;
}

export interface Call3Result {
  success: boolean;
  returnData: string;
}

// Per-request RPC timeout: fail over to a backup RPC quickly instead of hanging
const CALL_TIMEOUT_MS = SETTINGS.performance.rpcCallTimeoutMs;

/**
 * Multicall3 client on plain ethers v6.
 * - Holds a list of RPC URLs and automatically tries the next one on failure.
 *   Providers are cached per URL and are NOT destroyed: concurrent requests
 *   of the same client may still be using them.
 * - Limits the number of concurrent requests (semaphore) to avoid
 *   rate limits on public RPCs.
 * One instance per network — the semaphore and RPC selection are shared
 * across all tokens.
 */
export class MulticallClient {
  readonly multicallAddress: string;

  private rpcUrls: string[];
  private rpcIndex = 0; // index of the last RPC that responded successfully
  private contracts: (ethers.Contract | null)[];
  private readonly chainId?: number;

  private active = 0;
  private queue: (() => void)[] = [];
  private readonly maxConcurrent: number;

  constructor(
    rpcUrls: string[],
    multicallAddress: string,
    maxConcurrent: number = 5,
    chainId?: number
  ) {
    if (rpcUrls.length === 0) {
      throw new Error("MulticallClient: no RPC URL provided");
    }
    this.rpcUrls = [...new Set(rpcUrls)];
    this.contracts = new Array(this.rpcUrls.length).fill(null);
    this.multicallAddress = multicallAddress;
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.chainId = chainId;
  }

  private getContract(index: number): ethers.Contract {
    if (!this.contracts[index]) {
      // An explicit chainId skips the eth_chainId request and the
      // "failed to detect network" retry loop when an RPC is down.
      // batchMaxCount: 1 — don't merge requests into a JSON-RPC batch: many public
      // RPCs (drpc, roninchain) reject batches, and aggregation already happens
      // through Multicall3.
      const provider = new ethers.JsonRpcProvider(
        this.rpcUrls[index],
        this.chainId,
        { staticNetwork: true, batchMaxCount: 1 }
      );
      this.contracts[index] = new ethers.Contract(this.multicallAddress, MULTICALL3_ABI, provider);
    }
    return this.contracts[index]!;
  }

  async aggregate3(calls: Call3[]): Promise<Call3Result[]> {
    await this.acquire();
    try {
      let lastError: unknown;
      const startIndex = this.rpcIndex;

      for (let attempt = 0; attempt < this.rpcUrls.length; attempt++) {
        const index = (startIndex + attempt) % this.rpcUrls.length;
        try {
          const contract = this.getContract(index);
          const raw = await this.withTimeout(contract.aggregate3.staticCall(calls), index);
          this.rpcIndex = index; // remember the working RPC for subsequent requests
          return raw.map((r: { success: boolean; returnData: string }) => ({
            success: r.success,
            returnData: r.returnData,
          }));
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    } finally {
      this.release();
    }
  }

  private withTimeout<T>(promise: Promise<T>, rpcIndex: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`RPC timeout ${CALL_TIMEOUT_MS}ms (${this.rpcUrls[rpcIndex]})`)),
        CALL_TIMEOUT_MS
      );
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); }
      );
    });
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}
