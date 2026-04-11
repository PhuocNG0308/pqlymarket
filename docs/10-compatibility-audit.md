# PQlyMarket â€” Full Compatibility Audit (2026-05)

## Audit Scope
End-to-end flow: Contracts â†” Wallet â†” Proxy â†” Frontend â†” Chain

---

## 1. Smart Contracts â†’ Wallet Compatibility âœ…

### ABI & Bytecode
- All contracts compiled via `@theqrl/hypc` (Hyperion ^0.0.2)
- Artifacts in `artifacts/*.json` with fields: `contractName`, `abi`, `bytecode`
- ABI encoding is standard EVM ABI (same as Solidity)
- ethers.js v6 produces correct calldata from these ABIs

### On-Chain Verification
- `MarketFactory.createMarket("test", endTime)` â†’ `qrl_call` SUCCESS
- Gas estimate: 1,856,486 (via `qrl_estimateGas`)
- Function selector `0x883c84c1` matches ABI exactly
- Both ethers.js and `@theqrl/web3` produce identical calldata

### Opcodes
- Bytecode contains DUP9, SWAP8, SWAP9, SWAP10 (from PredictionMarket constructor with 6 params)
- All are valid EVM opcodes supported by ZVM (Zond Virtual Machine)

**Verdict**: Contracts are fully compatible.

---

## 2. Proxy Layer (wallet.js) âœ…

### Architecture
```
ethers.js BrowserProvider (eth_*)
  â†’ wallet.js createZondProxyProvider
    â†’ Read-only methods â†’ LOCAL_METHODS â†’ direct fetch to gqrl (qrl_*)
    â†’ Write methods â†’ mapEthMethod() â†’ wallet extension (qrl_*)
```

### Features
| Feature | Status |
|---------|--------|
| Auto-detect wallet prefix (qrl_* default, zond_* legacy fallback) | âœ… |
| Dynamic `mapEthMethod()` (prefix-agnostic) | âœ… |
| `convertRequestParams` uses base method name | âœ… |
| `hasAddressResponse()` is prefix-agnostic | âœ… |
| Chain ID from config (`config.chainId \|\| 32382`) | ✅ |

### Current Flow
1. **Auto-detection**: During `connectToWallet()`, tries `qrl_requestAccounts` first, falls back to `zond_requestAccounts` (v0.1.1 legacy)
2. **walletMethodPrefix**: Default `"qrl_"`, set to `"zond_"` only for legacy wallet
3. **mapEthMethod()**: `eth_sendTransaction` â†’ `qrl_sendTransaction`
4. **Persistence**: Prefix saved to localStorage (`pqly_wallet_prefix`) for auto-reconnect
5. **Reset**: Cleared on disconnect, resets to `"qrl_"`

### Read-Only Bypass
LOCAL_METHODS always go directly to the RPC endpoint via `fetch()` with `qrl_*` prefix. By default this is the RPC Proxy at `https://qrlwallet.com/api/qrl-rpc/testnet`, bypassing the wallet extension entirely.

**Verdict**: Proxy is production-ready.

---

## 3. Frontend â†’ Wallet âœ…

### Connection Order (CRITICAL)
```
1. qrl_requestAccounts        â†’ Connect DApp to wallet (MUST be first!)
2. wallet_addQRLChain          â†’ Add local chain (0x7e7f) to wallet
3. Create ethers.BrowserProvider â†’ Ready for contract calls
```

`wallet_addQRLChain` is in `QRL_WALLET_DAPP_CONNECTION_REQUIRED_METHODS`. If called before `requestAccounts`, it silently fails â†’ wallet stays on Testnet â†’ all txs go to wrong chain.

### Transaction Population
QRL Wallet requires ALL tx fields (ethers.js doesn't populate them):
- `type`: "0x2" (EIP-1559)
- `chainId`: "0x7e7f"
- `gas`: estimated via `qrl_estimateGas` with 4x buffer
- `maxFeePerGas`, `maxPriorityFeePerGas`: from latest block
- `nonce`: from `qrl_getTransactionCount`
- `value`: "0x0" for non-payable

The proxy's `populateTransactionFields()` fills all these before sending to wallet.

### Contract Interaction
```javascript
// Client-side pattern:
var contract = await PQlyWallet.getContractWithSigner("MarketFactory");
var tx = await contract.createMarket(question, endTime);
var receipt = await tx.wait();
```

ethers.js encodes the call â†’ proxy populates tx fields â†’ proxy translates eth_â†’qrl_ â†’ wallet signs + broadcasts.

**Verdict**: Frontend-to-wallet flow is correct.

---

## 4. Wallet â†’ Chain âœ…

### Internal Architecture (from source code analysis)
```
DApp â†’ qrl_sendTransaction â†’ Wallet Middleware Pipeline
  1. blockUnSupportedMethodsMiddleware (reject unknown methods)
  2. appendSenderDataMiddleware (add { url, tabId })
  3. unrestrictedMethodsMiddleware (read-only â†’ contentScript)
  4. restrictedMethodsMiddleware (write ops â†’ popup â†’ sign â†’ broadcast)
```

### How the wallet talks to the node
- **Unrestricted methods** (qrl_call, qrl_estimateGas): contentScript creates `new Web3(activeBlockchain.defaultRpcUrl)` â†’ `@theqrl/web3` v0.4.0 sends `qrl_call` to node
- **Restricted methods** (qrl_sendTransaction): Wallet signs internally, broadcasts via `@theqrl/web3` v0.4.0 â†’ `qrl_sendRawTransaction` to node

### Chain Selection
- Wallet uses `StorageUtil.getActiveBlockChain()` for RPC URL
- After `wallet_addQRLChain` succeeds, the configured chain is activated
- For testnet: uses RPC Proxy at `https://qrlwallet.com/api/qrl-rpc/testnet`
- For local dev: uses `http://127.0.0.1:8545` (Chain ID 0x7e7f)
- All wallet-to-node communication goes through the active chain's RPC URL

**Verdict**: Wallet-to-chain flow is correct (once proper connection order is followed).

---

## 5. Chain (gqrl) âœ…

- go-qrl v0.3.0: `qrl_*` RPC prefix (built from source)
- Chain ID: 32382 (0x7e7e) for public testnet, 32383 (0x7e7f) for local docker
- Q-prefix addresses throughout
- Supports all standard EVM opcodes including DUP9, SWAP8â€“SWAP10
- ZVM (Zond Virtual Machine) is EVM-compatible with post-quantum signatures (ML-DSA-87)
- `@theqrl/web3` v0.4.0 sends `qrl_*` natively â€” no proxy needed

**Verdict**: Chain operates correctly.

---

## Summary

| Layer | Status | Notes |
|-------|--------|-------|
| Contracts (Hyperion) | âœ… OK | ABI correct, opcodes valid |
| Proxy (wallet.js) | âœ… OK | eth_* â†’ qrl_*, Qâ†”0x conversion, legacy zond_* fallback |
| Frontend â†’ Wallet | âœ… OK | Correct connection order, tx population complete |
| Wallet â†’ Chain | âœ… OK | @theqrl/web3 v0.4.0 sends qrl_* natively |
| Chain (gqrl) | âœ… OK | qrl_* RPC, Q-prefix, EVM-compatible |

## Version Stack

| Component | Version | RPC Prefix | Address Prefix |
|-----------|---------|------------|----------------|
| gqrl (go-qrl) | v0.3.0 (from source) | `qrl_*` | Q |
| beacon-chain (qrysm) | main branch (from source) | â€” | Q |
| validator (qrysm) | main branch (from source) | â€” | Q |
| @theqrl/web3 | v0.4.0 | `qrl_*` | Q |
| QRL Web3 Wallet | main branch | `qrl_*` | Q |
| ethers.js | v6.13.5 | `eth_*` (proxied) | 0x |


