/**
 * QrlProvider — Custom HTTP provider for @theqrl/web3 that translates
 * zond_ RPC method prefix to qrl_ for go-qrl (gqrl) v0.3.0 compatibility.
 *
 * ⚠️ CURRENTLY NOT USED: Docker go-zond v0.2.3 uses zond_* prefix natively.
 * @theqrl/web3 also sends zond_* natively, so no translation is needed.
 * This provider is prepared for future go-qrl v0.3.0 which may use qrl_* prefix.
 *
 * Problem (future): @theqrl/web3 sends `zond_*` methods, but gqrl v0.3.0 only accepts `qrl_*`.
 * This provider intercepts every JSON-RPC request, rewrites the method prefix,
 * and rewrites the response so @theqrl/web3 doesn't notice the difference.
 *
 * Also handles Z↔Q address prefix translation:
 *   - Outgoing requests: Z-prefix addresses → Q-prefix (gqrl format)
 *   - Incoming responses: Q-prefix addresses → Z-prefix (@theqrl/web3 format)
 *
 * Usage:
 *   const { Web3 } = require("@theqrl/web3");
 *   const { QrlProvider } = require("./qrl-provider");
 *   const web3 = new Web3(new QrlProvider(process.env.RPC_URL || "https://rpc.pqlymarket.com/"));
 */

const http = require("http");
const https = require("https");

class QrlProvider {
  constructor(url) {
    this.url = new URL(url);
    this.connected = false;
    this._nextId = 1;
  }

  // Translate zond_ → qrl_ method prefix
  _translateMethod(method) {
    if (typeof method === "string" && method.startsWith("zond_")) {
      return "qrl_" + method.slice(5);
    }
    return method;
  }

  // Convert Z-prefix addresses to Q-prefix for gqrl
  _zToQ(obj) {
    if (typeof obj === "string") {
      return obj.replace(/^Z([0-9a-fA-F]{40})$/, "Q$1");
    }
    if (Array.isArray(obj)) return obj.map((v) => this._zToQ(v));
    if (obj && typeof obj === "object") {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this._zToQ(v);
      }
      return result;
    }
    return obj;
  }

  // Convert Q-prefix addresses to Z-prefix for @theqrl/web3
  _qToZ(obj) {
    if (typeof obj === "string") {
      return obj.replace(/^Q([0-9a-fA-F]{40})$/, "Z$1");
    }
    if (Array.isArray(obj)) return obj.map((v) => this._qToZ(v));
    if (obj && typeof obj === "object") {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this._qToZ(v);
      }
      return result;
    }
    return obj;
  }

  async request(payload) {
    // Handle both single and batch requests
    const isBatch = Array.isArray(payload);
    const requests = isBatch ? payload : [payload];

    const translated = requests.map((req) => ({
      ...req,
      method: this._translateMethod(req.method),
      params: this._zToQ(req.params),
    }));

    const body = JSON.stringify(isBatch ? translated : translated[0]);

    const response = await this._httpPost(body);
    const parsed = JSON.parse(response);

    // Translate Q addresses back to Z in the response
    return this._qToZ(parsed);
  }

  _httpPost(body) {
    return new Promise((resolve, reject) => {
      const lib = this.url.protocol === "https:" ? https : http;
      const options = {
        hostname: this.url.hostname,
        port: this.url.port,
        path: this.url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      };

      const req = lib.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          this.connected = true;
          resolve(data);
        });
      });

      req.on("error", (err) => {
        this.connected = false;
        reject(err);
      });
      req.write(body);
      req.end();
    });
  }

  // Provider interface methods required by @theqrl/web3
  supportsSubscriptions() {
    return false;
  }

  on() {}
  removeListener() {}
  once() {}
  removeAllListeners() {}
  connect() {}
  disconnect() {}
  reset() {}
}

module.exports = { QrlProvider };
