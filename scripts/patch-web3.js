#!/usr/bin/env node
/**
 * Patch @theqrl/web3-zond-accounts to add Descriptor + ExtraParams fields
 * required by go-qrl v0.3.0 DynamicFeeTx format.
 *
 * go-qrl v0.3.0 DynamicFeeTx RLP field order (13 fields):
 *   [chainId, nonce, gasTipCap, gasFeeCap, gas, to, value, data, accessList,
 *    Descriptor([3]byte), ExtraParams([]byte), publicKey, signature]
 *
 * @theqrl/web3 v0.3.3 only sends 11 fields (missing Descriptor + ExtraParams),
 * causing: "rlp: input string too long for [3]uint8, decoding into
 *           (types.DynamicFeeTx).Descriptor"
 *
 * This script patches the compiled JS to insert the missing fields.
 * Run via: node scripts/patch-web3.js  (or automatically via npm postinstall)
 */

const fs = require("fs");
const path = require("path");

const TARGET = path.join(
  __dirname,
  "..",
  "node_modules",
  "@theqrl",
  "web3-zond-accounts",
  "lib",
  "commonjs",
  "tx",
  "eip1559Transaction.js"
);

if (!fs.existsSync(TARGET)) {
  console.log("[patch-web3] @theqrl/web3-zond-accounts not found, skipping.");
  process.exit(0);
}

let src = fs.readFileSync(TARGET, "utf8");

// Check if already patched
if (src.includes("PATCHED: go-qrl v0.3.0 Descriptor")) {
  console.log("[patch-web3] Already patched, skipping.");
  process.exit(0);
}

let patchCount = 0;

// ── Patch 1: Constructor — store descriptor + extraParams ────────────
// Insert before: `const freeze = ...`
const constructorOld =
  `const freeze = (_a = opts === null || opts === void 0 ? void 0 : opts.freeze) !== null && _a !== void 0 ? _a : true;`;
const constructorNew =
  `// PATCHED: go-qrl v0.3.0 Descriptor + ExtraParams
        const descData = txData.descriptor;
        if (descData !== undefined && descData !== null) {
            this.descriptor = descData instanceof Uint8Array ? descData : Uint8Array.from(descData);
        } else {
            this.descriptor = Uint8Array.from([0x01, 0x00, 0x00]); // ML-DSA-87 (wallettype=1 in go-qrllib)
        }
        const epData = txData.extraParams;
        if (epData !== undefined && epData !== null) {
            this.extraParams = epData instanceof Uint8Array ? epData : Uint8Array.from(epData);
        } else {
            this.extraParams = Uint8Array.from([]);
        }
        ${constructorOld}`;

if (src.includes(constructorOld)) {
  src = src.replace(constructorOld, constructorNew);
  patchCount++;
  console.log("[patch-web3] Patched constructor (descriptor + extraParams)");
} else {
  console.error("[patch-web3] WARNING: Could not find constructor freeze pattern");
}

// ── Patch 2: raw() — add Descriptor + ExtraParams fields ────────────
const rawOld = `this.accessList,
            this.publicKey !== undefined ? this.publicKey : Uint8Array.from([]),
            this.signature !== undefined ? this.signature : Uint8Array.from([]),
        ];`;
const rawNew = `this.accessList,
            this.descriptor !== undefined ? this.descriptor : Uint8Array.from([0x01, 0x00, 0x00]),
            this.extraParams !== undefined ? this.extraParams : Uint8Array.from([]),
            this.publicKey !== undefined ? this.publicKey : Uint8Array.from([]),
            this.signature !== undefined ? this.signature : Uint8Array.from([]),
        ];`;

if (src.includes(rawOld)) {
  src = src.replace(rawOld, rawNew);
  patchCount++;
  console.log("[patch-web3] Patched raw() method");
} else {
  console.error("[patch-web3] WARNING: Could not find raw() pattern");
}

// ── Patch 3: getMessageToSign() — include Descriptor+ExtraParams in hash ─
// go-qrl signs over 11 fields: [chainId...accessList, descriptor, extraParams]
const hashOld = `const base = this.raw().slice(0, 9);`;
const hashNew = `const base = this.raw().slice(0, 11); // go-qrl v0.3.0: sign over 11 fields incl. descriptor+extraParams`;

if (src.includes(hashOld)) {
  src = src.replace(hashOld, hashNew);
  patchCount++;
  console.log("[patch-web3] Patched getMessageToSign() hash range");
} else {
  console.error("[patch-web3] WARNING: Could not find getMessageToSign() pattern");
}

// ── Patch 4: fromValuesArray() — handle 11/13 fields ────────────────
const fvaOld = `if (values.length !== 9 && values.length !== 11) {
            throw new Error('Invalid EIP-1559 transaction. Only expecting 9 values (for unsigned tx) or 11 values (for signed tx).');
        }
        const [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, publicKey, signature,] = values;`;
const fvaNew = `if (values.length !== 11 && values.length !== 13) {
            throw new Error('Invalid EIP-1559 transaction. Expecting 11 values (unsigned) or 13 values (signed) for go-qrl v0.3.0.');
        }
        const [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, descriptor, extraParams, publicKey, signature,] = values;`;

if (src.includes(fvaOld)) {
  src = src.replace(fvaOld, fvaNew);
  patchCount++;
  console.log("[patch-web3] Patched fromValuesArray() field count + destructuring");
} else {
  console.error("[patch-web3] WARNING: Could not find fromValuesArray() pattern");
}

// Also patch the return statement in fromValuesArray to include descriptor + extraParams
const fvaRetOld = `accessList: accessList !== null && accessList !== void 0 ? accessList : [],
            publicKey,
            signature,`;
const fvaRetNew = `accessList: accessList !== null && accessList !== void 0 ? accessList : [],
            descriptor,
            extraParams,
            publicKey,
            signature,`;

if (src.includes(fvaRetOld)) {
  src = src.replace(fvaRetOld, fvaRetNew);
  patchCount++;
  console.log("[patch-web3] Patched fromValuesArray() return fields");
} else {
  console.error("[patch-web3] WARNING: Could not find fromValuesArray() return pattern");
}

// ── Patch 5: _processSignatureAndPublicKey() — pass through descriptor ──
const procOld = `accessList: this.accessList,
            publicKey: publicKey,
            signature: signature,`;
const procNew = `accessList: this.accessList,
            descriptor: this.descriptor,
            extraParams: this.extraParams,
            publicKey: publicKey,
            signature: signature,`;

if (src.includes(procOld)) {
  src = src.replace(procOld, procNew);
  patchCount++;
  console.log("[patch-web3] Patched _processSignatureAndPublicKey()");
} else {
  console.error("[patch-web3] WARNING: Could not find _processSignatureAndPublicKey() pattern");
}

// Write patched file
fs.writeFileSync(TARGET, src, "utf8");
console.log(`[patch-web3] Done! Applied ${patchCount}/6 patches to eip1559Transaction.js`);

if (patchCount < 6) {
  console.error("[patch-web3] WARNING: Some patches failed. Check the file manually.");
  process.exit(1);
}
