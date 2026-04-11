/**
 * QrlJsonRpcProvider — ethers.js v6 provider that translates eth_ → qrl_ RPC
 * methods for compatibility with go-qrl (gqrl) v0.3.0 execution node.
 *
 * gqrl uses qrl_* methods and Q-prefix addresses. This provider intercepts
 * all JSON-RPC calls, rewrites method prefixes, and handles Q↔0x address formats.
 *
 * Note: We always translate (no flag) because the parent constructor triggers
 * _detectNetwork() → send("eth_chainId") before subclass fields are initialized.
 */
import { ethers } from "ethers";

export class QrlJsonRpcProvider extends ethers.JsonRpcProvider {
  constructor(url: string) {
    // Pass staticNetwork to skip automatic _detectNetwork() during construction,
    // then we detect manually via our translated send().
    super(url, new ethers.Network("qrl", 32382), { staticNetwork: true });
  }

  async send(method: string, params: Array<any>): Promise<any> {
    // Translate eth_ → qrl_ method prefix
    const qrlMethod = method.startsWith("eth_")
      ? "qrl_" + method.slice(4)
      : method;

    // Convert 0x addresses to Q-prefix in params for gqrl
    const qrlParams = this._convertAddresses(params, "0x", "Q");

    const result = await super.send(qrlMethod, qrlParams);

    // gqrl omits difficulty for PoS blocks — ethers.js requires it
    if (
      (method === "eth_getBlockByNumber" || method === "eth_getBlockByHash") &&
      result !== null
    ) {
      if (result.difficulty === null || result.difficulty === undefined) {
        result.difficulty = "0x0";
      }
    }

    // Convert Q-prefix addresses back to 0x in results for ethers
    return this._convertAddresses(result, "Q", "0x");
  }

  private _convertAddresses(obj: any, from: string, to: string): any {
    if (typeof obj === "string") {
      // Match Q/0x + 40 hex chars (address format)
      const regex = new RegExp(`^${this._escapeRegex(from)}([0-9a-fA-F]{40})$`);
      return obj.replace(regex, `${to}$1`);
    }
    if (Array.isArray(obj)) {
      return obj.map((v) => this._convertAddresses(v, from, to));
    }
    if (obj && typeof obj === "object") {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this._convertAddresses(v, from, to);
      }
      return result;
    }
    return obj;
  }

  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
