# QRL Web3 Wallet Extension â€” Internals Reference

> Source: https://github.com/theQRL/qrl-web3-wallet (main branch, fetched 2026-05)
> Current main branch â€” uses `qrl_*` prefix, `@theqrl/web3@^0.4.0`, Q-prefix addresses
> Legacy v0.1.1 (Feb 26 2025) â€” used `zond_*` prefix (deprecated)

## Architecture Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    EIP-1193 request()     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  DApp page   â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â†’â”‚  inPageScript.ts   â”‚
â”‚ (ethers.js)  â”‚                           â”‚  (injected into    â”‚
â”‚              â”‚                           â”‚   MAIN world)      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                    â”‚ PostMessage
                                                    â–¼
                                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                           â”‚ contentScript.ts   â”‚
                                           â”‚ (content script)   â”‚
                                           â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                â”‚      â”‚
                              Unrestricted      â”‚      â”‚  Restricted
                              methods           â”‚      â”‚  methods
                              (via message)     â”‚      â”‚  (via port)
                                                â–¼      â–¼
                                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                           â”‚ serviceWorker.ts   â”‚
                                           â”‚ (background)       â”‚
                                           â”‚                    â”‚
                                           â”‚ Middleware Pipeline:â”‚
                                           â”‚ 1. blockUnsupportedâ”‚
                                           â”‚ 2. appendSenderDataâ”‚
                                           â”‚ 3. unrestricted    â”‚
                                           â”‚ 4. restricted      â”‚
                                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                    â”‚
                                            â”Œâ”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”
                                            â”‚               â”‚
                              Unrestricted  â–¼   Restricted  â–¼
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚contentScript â”‚  â”‚  Wallet UI Popup     â”‚
                         â”‚uses @theqrl/ â”‚  â”‚  (user approval)     â”‚
                         â”‚web3 v0.4.0   â”‚  â”‚  Signs + broadcasts  â”‚
                         â”‚internally    â”‚  â”‚  via @theqrl/web3    â”‚
                         â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚                     â”‚
                                â–¼                     â–¼
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚       gqrl / go-qrl node        â”‚
                         â”‚  (qrl_* JSON-RPC prefix natively â”‚
                         â”‚   via @theqrl/web3 v0.4.0)       â”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Key insight**: The wallet does NOT forward `qrl_*` methods directly to the node.
The contentScript creates its own `@theqrl/web3` instance pointed at the active chain's RPC URL, and calls the node using web3's built-in methods (which use `qrl_*` natively in v0.4.0).

## Provider Info (EIP-6963)

```typescript
// src/scripts/constants/streamConstants.ts
QRL_WEB3_WALLET_PROVIDER_INFO = {
  NAME: "QRLWeb3Wallet",
  RDNS: "theqrl.org",
  ICON: "data:image/svg+xml;base64,...",
}
```

## Blockchain Configuration

```typescript
// src/configuration/qrlBlockchainConfig.ts
QRL_MAINNET = { chainId: "0x1",   chainName: "Zond Mainnet", rpcUrls: ["http://127.0.0.1:8545"] }
QRL_TESTNET = { chainId: "0x7e7e", chainName: "Zond Testnet", rpcUrls: ["https://qrlwallet.com/api/qrl-rpc/testnet"] }

DEFAULT_BLOCKCHAIN = QRL_BLOCKCHAINS[1]  // Testnet is default
```

Custom chains can be added via `wallet_addQRLChain`. They are stored in browser.storage.local.

## Method Prefixes â€” Version Differences

| Context | v0.1.1 (legacy) | main branch (current) |
|---------|-------------------|------------------------|
| DApp â†’ Wallet | `zond_*` | `qrl_*` |
| Wallet â†’ Node (internal) | `zond_*` (via @theqrl/web3 v0.3.x) | `qrl_*` (via @theqrl/web3 v0.4.0) |
| Chain management | `wallet_addQRLChain` | `wallet_addQRLChain` |

**Note**: With @theqrl/web3 v0.4.0, both DApp-facing methods AND internal node communication use `qrl_*`. No translation needed anywhere in the stack.

## Supported Methods (latest main branch)

### Restricted Methods (require user popup approval)

```
qrl_requestAccounts      â€” Connect DApp, authorize account access
qrl_sendTransaction      â€” Sign + broadcast transaction
qrl_signTypedData_v4     â€” EIP-712 typed data signing
personal_sign            â€” Personal message signing
wallet_addQRLChain       â€” Add custom blockchain
wallet_switchQRLChain    â€” Switch active blockchain
wallet_watchAsset        â€” Add token to wallet UI
wallet_requestPermissionsâ€” Request DApp permissions
wallet_sendCalls         â€” Batch transactions (EIP-5792)
wallet_getCapabilities   â€” Check wallet capabilities
```

### Unrestricted Methods (no popup, handled by contentScript)

```
qrl_accounts             â€” Get connected accounts (requires prior DApp connection)
qrl_call                 â€” Read-only contract call
qrl_chainId              â€” Get active chain ID
qrl_estimateGas          â€” Estimate gas
qrl_getBalance           â€” Get QRL balance
qrl_getCode              â€” Get contract bytecode
qrl_getBlockByNumber     â€” Get block data
qrl_getBlockByHash       â€” Get block by hash
qrl_getTransactionReceiptâ€” Get tx receipt
qrl_getTransactionByHash â€” Get tx data
qrl_getTransactionCount  â€” Get nonce
qrl_blockNumber          â€” Get latest block number
qrl_sendRawTransaction   â€” Broadcast pre-signed tx (no popup!)
qrl_gasPrice             â€” Get gas price
qrl_feeHistory           â€” Get fee history (EIP-1559)
qrl_getLogs              â€” Get event logs
qrl_getStorageAt         â€” Read storage slot
qrl_getProof             â€” Get Merkle proof
qrl_newFilter            â€” Create event filter
qrl_getFilterChanges     â€” Poll filter changes
qrl_getFilterLogs        â€” Get filter logs
qrl_uninstallFilter      â€” Remove filter
qrl_newBlockFilter       â€” Create block filter
qrl_newPendingTransactionFilter â€” Create pending tx filter
qrl_subscribe            â€” WebSocket subscription
qrl_unsubscribe          â€” Remove subscription
qrl_syncing              â€” Get sync status
net_version              â€” Get network ID
web3_clientVersion       â€” Get node version
wallet_getPermissions    â€” Get DApp permissions
wallet_revokePermissions â€” Revoke DApp permissions
wallet_getCallsStatus    â€” Get batch tx status (EIP-5792)
zondWallet_getProviderState â€” Get wallet state (chainId, accounts)
```

## Middleware Pipeline Detail

### 1. blockUnSupportedMethodsMiddleware
- Checks `req.method` is in `ALL_REQUEST_METHODS` (union of restricted + unrestricted)
- If not found â†’ returns error: "The method does not exist / is not available"
- **This is why sending `eth_*` to the wallet would fail! Legacy `zond_*` methods are also rejected by the current wallet.**

### 2. appendSenderDataMiddleware
- Attaches `{ url, tabId }` to `req.senderData` so middleware can check DApp origin

### 3. unrestrictedMethodsMiddleware
- Handles unrestricted methods
- `qrl_accounts` requires prior DApp connection (checks `checkUrlOriginHasBeenConnected`)
- Sends message to contentScript via `browser.tabs.sendMessage(tabId, ...)`
- contentScript creates `@theqrl/web3` instance with active chain's RPC URL and executes

### 4. restrictedMethodsMiddleware
- **Step 1: `checkRequestCanProceed()`**
  - For `wallet_addQRLChain`, `wallet_switchQRLChain`, `wallet_getCapabilities`:
    - Checks `checkUrlOriginHasBeenConnected()` â€” DApp must be connected first
    - If not connected â†’ silently returns error (no popup shown!)
  - For `qrl_sendTransaction`, `qrl_signTypedData_v4`, `personal_sign`:
    - Checks `checkAccountHasBeenAuthorized()` â€” account must be authorized

- **Step 2: `checkRequestCanCompleteSilently()`**
  - `wallet_addQRLChain`: If chainId exists in stored blockchains â†’ silently activates via `StorageUtil.setActiveBlockChain(chainId)`. Otherwise â†’ `hasCompleted: false`
  - `wallet_switchQRLChain`: If already current chain OR DApp-connected chain â†’ silently switches. Otherwise â†’ `hasCompleted: false`
  - `wallet_getCapabilities`: Returns capabilities immediately

- **Step 3: Open popup for user approval**
  - Opens extension popup via `browser.action.openPopup()`
  - Waits for `DAPP_RESPONSE` message from UI
  - User approves/rejects in the popup

## How `qrl_sendTransaction` Works

1. DApp sends `qrl_sendTransaction` with tx params (from, to, data, value, gas, etc.)
2. Middleware checks: method is restricted â†’ check account authorized â†’ open popup
3. Wallet UI shows transaction details to user
4. User approves â†’ wallet signs tx using stored keystore (ML-DSA-87 signature)
5. Wallet broadcasts signed tx via `@theqrl/web3` â†’ `qrl_sendRawTransaction` â†’ node
6. Returns transaction hash to DApp

**The wallet handles signing AND broadcasting.** The DApp only needs to send the unsigned tx params.

## How Unrestricted Methods Work (e.g., qrl_call, qrl_estimateGas)

1. DApp sends `qrl_call` with call params
2. serviceWorker â†’ unrestrictedMethodsMiddleware â†’ sends message to contentScript tab
3. contentScript receives message, calls `getQrlProperties()`:
   ```typescript
   const { defaultRpcUrl } = await StorageUtil.getActiveBlockChain();
   const qrlHttpProvider = new Web3.providers.HttpProvider(defaultRpcUrl);
   const { qrl } = new Web3({ provider: qrlHttpProvider });
   ```
4. Uses `qrl.call(transactionObj, blockParam)` â€” @theqrl/web3 v0.4.0 sends `qrl_call` to node
5. Returns result back through the message chain to DApp

**The contentScript uses the ACTIVE blockchain's RPC URL** â€” this is why `wallet_addQRLChain` must succeed before making calls. If the wallet is still on Testnet, all reads go to the public testnet too.

## DApp Connection Flow (Correct Order)

```
1. qrl_requestAccounts    â†’ Popup: "Connect to DApp?" â†’ User approves
                           â†’ Updates connected accounts + blockchains for origin
                           â†’ Returns [account_address]

2. wallet_addQRLChain     â†’ If chainId exists: silently activates
                           â†’ If new: Popup: "Add chain?" â†’ User approves
                           â†’ Chain added to storage + activated

3. qrl_call / qrl_sendTransaction / etc. â†’ Now uses correct chain
```

**CRITICAL ORDER**: `qrl_requestAccounts` MUST be called BEFORE `wallet_addQRLChain` because:
- `wallet_addQRLChain` is in `QRL_WALLET_DAPP_CONNECTION_REQUIRED_METHODS`
- `checkRequestCanProceed()` checks `checkUrlOriginHasBeenConnected()` first
- If DApp not connected â†’ returns error silently â†’ chain not switched

## Custom Chain Addition via wallet_addQRLChain

Params structure:
```typescript
{
  chainId: "0x7e7f",             // hex string
  chainName: "QRL Local Dev",
  rpcUrls: ["http://127.0.0.1:8545"],
  nativeCurrency: { name: "Quanta", symbol: "QRL", decimals: 18 },
  blockExplorerUrls: [],
  iconUrls: [],
}
```

If chainId matches a stored chain â†’ `StorageUtil.setActiveBlockChain(chainId)` â†’ silently activates.
If new â†’ popup for user approval â†’ chain stored + activated.

## Address Format
- QRL uses `Q` prefix instead of `0x` for addresses
- `Q20fE5d32C2BDd3e5854503053459017A933ADa1c` â†” `0x20fE5d32C2BDd3e5854503053459017A933ADa1c`
- Wallet returns Q-prefixed addresses
- `@theqrl/web3` v0.4.0 handles Q prefix natively
- ethers.js requires 0x prefix â†’ DApp proxy must convert

## Version Migration Notes

The current wallet (main branch) uses `qrl_*` prefix. DApps using the old `zond_*` prefix will be rejected by `blockUnSupportedMethodsMiddleware`. PQlyMarket's `wallet.js` handles this automatically:

1. Try `qrl_requestAccounts` first (current wallet)
2. Fall back to `zond_requestAccounts` if rejected (legacy v0.1.1)
3. Store detected prefix for subsequent calls

## Key Source Files

| File | Purpose |
|------|---------|
| `src/scripts/inPageScript.ts` | Injects EIP-6963 provider into page |
| `src/scripts/contentScript.ts` | Bridge pageâ†”extension, handles unrestricted methods |
| `src/scripts/serviceWorker.ts` | Background middleware pipeline |
| `src/scripts/constants/requestConstants.ts` | Method allowlists |
| `src/scripts/constants/streamConstants.ts` | Provider info, message names |
| `src/scripts/middlewares/blockUnSupportedMethodsMiddleware.ts` | Blocks unknown methods |
| `src/scripts/middlewares/restrictedMethodsMiddleware.ts` | Handles restricted methods (popup) |
| `src/scripts/middlewares/unrestrictedMethodsMiddleware.ts` | Handles unrestricted methods |
| `src/configuration/qrlBlockchainConfig.ts` | Chain configs (Mainnet/Testnet) |
| `src/utilities/storageUtil.ts` | Browser storage management |

