/**
 * QrlJsonRpcProvider — ethers.js v6 provider that translates eth_ → qrl_ RPC
 * methods for compatibility with go-qrl (gqrl) v0.3.0 execution node.
 *
 * gqrl uses qrl_* methods and Q-prefix addresses. This provider intercepts
 * all JSON-RPC calls, rewrites method prefixes, and handles Q↔0x address formats.
 *
 * The QRL RPC Proxy wraps responses and assigns its own request IDs, which
 * breaks ethers.js ID matching. We override _send() to make raw HTTP requests
 * and fix the ID mismatch.
 */
import { ethers } from "ethers";
import type {
  JsonRpcPayload,
  JsonRpcResult,
} from "ethers";

export class QrlJsonRpcProvider extends ethers.JsonRpcProvider {
  private _rpcUrl: string;

  constructor(url: string) {
    // Pass staticNetwork to skip automatic _detectNetwork() during construction,
    // then we detect manually via our translated send().
    super(url, new ethers.Network("qrl", 1337), { staticNetwork: true });
    this._rpcUrl = url;
  }

  /**
   * Low-level transport override. The QRL RPC Proxy:
   *   1. Wraps single requests into a batch response: [{...}]
   *   2. Assigns its own internal request ID (different from ours)
   * ethers.js then can't match response.id to request.id → BAD_DATA error.
   *
   * Fix: make the HTTP call ourselves and re-stamp response IDs to match.
   */
  async _send(payload: JsonRpcPayload | Array<JsonRpcPayload>): Promise<Array<JsonRpcResult>> {
    const payloads = Array.isArray(payload) ? payload : [payload];

    // Translate eth_ → qrl_ and convert addresses in each request
    const translated = payloads.map((p) => ({
      jsonrpc: p.jsonrpc || "2.0",
      id: p.id,
      method: p.method.startsWith("eth_") ? "qrl_" + p.method.slice(4) : p.method,
      params: this._convertAddresses(p.params, "0x", "Q"),
    }));

    // Send as single request (not batch) since proxy expects that
    const body = translated.length === 1 ? translated[0] : translated;

    const response = await fetch(this._rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await response.json();

    // Proxy may return array or single object — normalize to array
    const results: Array<any> = Array.isArray(json) ? json : [json];

    // Re-stamp each response ID to match the original request ID
    // (proxy replaces IDs with its own internal ones)
    // Only include `error` key when the proxy actually returned an error,
    // because ethers.js checks `"error" in resp` (key existence, not truthiness).
    return results.map((r: any, i: number) => {
      const base: any = {
        id: payloads[i]?.id ?? r.id,
        jsonrpc: r.jsonrpc || "2.0",
      };
      if (r.error !== undefined && r.error !== null) {
        base.error = r.error;
      } else {
        base.result = r.result;
      }
      return base;
    });
  }

  async send(method: string, params: Array<any>): Promise<any> {
    // super.send() will call our _send() override
    const result = await super.send(method, params);

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
