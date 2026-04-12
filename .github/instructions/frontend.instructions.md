---
description: "Use when: building frontend components, connecting wallet, reading/writing blockchain data in the Express/EJS frontend. Use for: wallet connection, contract interaction, QRL wallet integration, market UI."
applyTo: "frontend/**"
---

# PQlyMarket Frontend Development

## Tech Stack
- Express + EJS (server-rendered pages, NOT Next.js)
- TypeScript (server-side in `frontend/src/`)
- Client-side vanilla JS in `frontend/public/js/`
- Tailwind CSS for styling
- ethers.js v6 (Interface only, for ABI encoding/decoding + parseEther/formatEther utilities)
- `@theqrl/web3` for server-side blockchain indexing (`frontend/src/services/`)
- QRL Web3 Wallet Extension for wallet connection (via EIP-6963)

## Direct Provider Architecture (MyQRLWallet-style)
No ethers.js BrowserProvider or proxy. Contract interactions use direct `provider.request()` for writes and direct JSON-RPC `fetch()` for reads.

### Method Flow â€” Write Operations
```
app.js: PQlyWallet.writeContract("MarketFactory", "createMarket", [q, t])
  â†“ ethers.Interface.encodeFunctionData()
wallet.js: sendTransaction({ to, data, value })
  â†“ buildTransaction() populates gas, fees, nonce via rpcCall()
  â†“ walletProvider.request({ method: prefix + "sendTransaction", params: [...] })
QRL Web3 Wallet Extension (raw EIP-1193 provider)
  â†“ signs + broadcasts to gqrl
gqrl node (go-qrl v0.3.0)
```

### Method Flow â€” Read Operations
```
app.js: PQlyWallet.readContract("MarketFactory", "markets", [id])
  â†“ ethers.Interface.encodeFunctionData()
wallet.js: ethCall(address, calldata) â†’ rpcCall("qrl_call", ...)
  â†“ direct fetch() to gqrl (bypasses wallet entirely)
gqrl node â†’ response
  â†“ ethers.Interface.decodeFunctionResult()
app.js: receives decoded result
```

### Method Prefix Detection
```javascript
// wallet.js auto-detects which prefix the installed wallet supports:
// 1. Try qrl_chainId (current wallet) â€” default
// 2. Fall back to zond_chainId (legacy v0.1.1 wallet)
// walletMethodPrefix is set to "qrl_" (default) or "zond_" (legacy)
// All write operations use: walletProvider.request({ method: prefix + "sendTransaction" })
```

### Read-Only Methods Bypass Wallet
All read-only calls go DIRECTLY to gqrl via `rpcCall()` (fetch-based), bypassing the wallet extension entirely. This includes: qrl_call, qrl_getBalance, qrl_estimateGas, qrl_getTransactionCount, qrl_getTransactionReceipt, qrl_getBlockByNumber.

### Address Conversion
QRL uses `Q` prefix instead of `0x`. Direct RPC to gqrl uses `Q` addresses.
- Outgoing (to gqrl/wallet): `0x...` â†’ `Q...` (evmToZond)
- Incoming (from wallet): `Q...` â†’ `0x...` (zondToEvm)
- Internal state (currentAccount) always stored as `0x` for ethers.js compatibility.

### Transaction Population
QRL Web3 Wallet requires ALL tx fields (type, chainId, gas, maxFeePerGas, maxPriorityFeePerGas, nonce, value). `buildTransaction()` in wallet.js populates these via direct RPC calls to gqrl before forwarding to the wallet.

## Wallet Connection Order (CRITICAL)
```
1. Health check: qrl_chainId / zond_chainId                       â†’ Detect prefix
2. qrl_requestAccounts (or zond_requestAccounts)                   â†’ Connect DApp (MUST be before chain add!)
3. wallet_addQRLChain / wallet_switchQRLChain                      â†’ Add/activate local chain
4. Store raw walletProvider + currentAccount                       â†’ Ready for contract calls
```

## Key Pages
1. `/` - Market list (browse all prediction markets)
2. `/market/:id` - Market detail (buy/sell shares, view odds)
3. `/portfolio` - User's positions and P&L
4. `/create` - Create markets (admin only)
5. `/governance` - Governance oracle voting
6. `/leaderboard` - User rankings

## Contract Interaction Patterns

### Client-side write (state-changing):
```javascript
// Named contract (address from config):
var tx = await PQlyWallet.writeContract("MarketFactory", "createMarket", [question, endTime]);
await tx.wait();

// Dynamic address (e.g., PredictionMarket resolved from factory):
var marketResult = await PQlyWallet.readContract("MarketFactory", "markets", [marketId]);
var marketAddr = marketResult[0];
var resp = await fetch("/api/abi/PredictionMarket");
var data = await resp.json();
var value = "0x" + ethers.parseEther(amount).toString(16);
var tx = await PQlyWallet.writeContractAt(marketAddr, data.abi, "buyShares", [isYes, 0], { value: value });
await tx.wait();
```

### Client-side read (view/pure):
```javascript
// Named contract:
var result = await PQlyWallet.readContract("MarketFactory", "markets", [marketId]);
var marketAddr = result[0];

// Dynamic address:
var bal = await PQlyWallet.readContractAt(ctAddr, abi, "balanceOf", [account, tokenId]);
var shares = bal[0]; // BigInt

// Balance:
var rawBal = await PQlyWallet.getBalance(account); // hex string
var wei = BigInt(rawBal);
```

### Server-side (Express routes via @theqrl/web3 v0.4.0):
```javascript
import Web3 from '@theqrl/web3';
const web3 = new Web3('https://rpc.pqlymarket.com/');
const contract = new web3.qrl.Contract(abi, address);
const data = await contract.methods.getMarket(id).call();
```

## PQlyWallet Public API
```javascript
window.PQlyWallet = {
  // Connection
  connect(), disconnect(), showPicker(), closePicker(), toggleMenu(), onReady(cb),
  getAccount(),               // Returns 0x-prefixed account or null
  getWalletProvider(),        // Returns raw EIP-1193 provider

  // Contract interaction
  readContract(name, method, args),           // Named contract read
  writeContract(name, method, args, opts),    // Named contract write â†’ {hash, wait()}
  readContractAt(addr, abi, method, args),    // Dynamic address read
  writeContractAt(addr, abi, method, args, opts), // Dynamic address write â†’ {hash, wait()}
  sendTransaction(opts),      // Raw tx: { to, data, value }
  waitForTransaction(hash),   // Poll for receipt

  // Direct RPC
  rpcCall(method, params),    // Raw JSON-RPC to gqrl
  getBalance(addr),           // qrl_getBalance â†’ hex string
  ethCall(to, data),          // qrl_call â†’ hex result

  // Utilities
  zondToEvm(addr), evmToZond(addr),
  refreshBalance(), showToast(msg, type), getDiscoveredWallets(),
};
```

## Configuration
- Contract addresses: `frontend/src/config/contracts.ts` (loaded from `deployment.json`)
- Client config injected via EJS template as `window.__PQLY_CONFIG__`
- Chain ID: 32382 (public testnet via RPC proxy), 32383 (local Docker)
- RPC Proxy (default): `https://rpc.pqlymarket.com/`

## Reference
- Full wallet architecture: `docs/09-qrl-wallet-extension-internals.md`
