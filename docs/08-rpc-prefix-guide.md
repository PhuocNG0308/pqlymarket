# HÆ°á»›ng dáº«n RPC Prefix â€” QRL Zond

> TÃ i liá»‡u nÃ y ghi láº¡i cÃ¡ch sá»­ dá»¥ng RPC method prefix trong PQlyMarket.
> Cáº­p nháº­t láº§n cuá»‘i: 2026-05

## TÃ³m táº¯t

Táº¥t cáº£ cÃ¡c thÃ nh pháº§n hiá»‡n táº¡i Ä‘á»u sá»­ dá»¥ng prefix **`qrl_*`** vÃ  Ä‘á»‹a chá»‰ **Q-prefix**. KhÃ´ng cáº§n proxy/translation giá»¯a wallet â†” @theqrl/web3 â†” gqrl.

## Báº£ng tÃ³m táº¯t prefix

| ThÃ nh pháº§n | PhiÃªn báº£n | RPC Prefix | Address Prefix |
|---|---|---|---|
| gqrl (go-qrl) | v0.3.0 | `qrl_*` | Q-prefix |
| @theqrl/web3 | v0.4.0 | `qrl_*` (native) | Q-prefix |
| QRL Web3 Wallet Extension | main branch | `qrl_*` (DApp-facing) | Q-prefix |
| QRL Web3 Wallet Extension | v0.1.1 (legacy) | `zond_*` | Z-prefix |
| ethers.js v6 | 6.13.5 | `eth_*` (cáº§n proxy) | 0x-prefix |
| Public testnet | â€” | `qrl_*` | Q-prefix |

## Kiáº¿n trÃºc hiá»‡n táº¡i â€” KHÃ”NG Cáº¦N PROXY giá»¯a wallet â†” node

```
QRL Web3 Wallet Extension (main branch)
  â†’ qrl_sendTransaction (DApp-facing)
  â†’ internal: @theqrl/web3 v0.4.0 â†’ qrl_sendRawTransaction â†’ gqrl
       â†‘ táº¥t cáº£ Ä‘á»u qrl_* â€” khÃ´ng cáº§n translation
```

Chá»‰ cáº§n proxy cho ethers.js (eth_* â†’ qrl_*):

### Server-side (Node.js / ethers.js)
```
ethers.js â†’ QrlJsonRpcProvider â†’ gqrl
  eth_call â†’ qrl_call
  0x-prefix â†’ Q-prefix
```
File: `frontend/src/services/qrl-provider.ts`

### Client-side (Browser / ethers.js BrowserProvider)
```
ethers.js BrowserProvider â†’ createZondProxyProvider â†’ gqrl / wallet extension

ÄÆ°á»ng Ä‘i 1: LOCAL_METHODS (read-only, gá»­i trá»±c tiáº¿p tá»›i gqrl)
  eth_blockNumber â†’ qrl_blockNumber (rpcCall trá»±c tiáº¿p)
  eth_call â†’ qrl_call (rpcCall trá»±c tiáº¿p)
  eth_getBalance â†’ qrl_getBalance (rpcCall trá»±c tiáº¿p)
  ...

ÄÆ°á»ng Ä‘i 2: Write methods (gá»­i qua wallet extension)
  eth_sendTransaction â†’ populateTransactionFields() â†’ qrl_sendTransaction (wallet ext)
```
File: `frontend/public/js/wallet.js`

### Deploy script (@theqrl/web3 v0.4.0)
```
@theqrl/web3 v0.4.0 â†’ gqrl (trá»±c tiáº¿p, khÃ´ng cáº§n proxy)
  web3.qrl.Contract â†’ qrl_* native â†’ gqrl
```
File: `scripts/deploy-qrl.js`

## Backward Compatibility (Legacy v0.1.1 Wallet)

`wallet.js` váº«n há»— trá»£ wallet v0.1.1 (zond_*):
1. Thá»­ `qrl_requestAccounts` trÆ°á»›c (wallet má»›i nháº¥t)
2. Náº¿u tháº¥t báº¡i â†’ fallback `zond_requestAccounts` (v0.1.1)
3. `walletMethodPrefix` Ä‘Æ°á»£c set tÆ°Æ¡ng á»©ng ("qrl_" hoáº·c "zond_")

## LÆ°u Ã½ quan trá»ng

1. **gqrl v0.3.0 CHá»ˆ hiá»ƒu `qrl_*`** â€” `zond_*` sáº½ tráº£ vá» lá»—i `-32601`
2. **@theqrl/web3 v0.4.0 sá»­ dá»¥ng `web3.qrl.*`** â€” property `web3.zond` khÃ´ng cÃ²n tá»“n táº¡i
3. **Wallet extension (main branch) chá»‰ cháº¥p nháº­n `qrl_*`** â€” `zond_*` bá»‹ cháº·n bá»Ÿi `blockUnSupportedMethodsMiddleware`
4. **KhÃ´ng cáº§n engine-proxy.js hay rpc-proxy.js** ná»¯a â€” táº¥t cáº£ Ä‘á»u native `qrl_*`

## PhiÃªn báº£n cÅ© (Lá»‹ch sá»­)

| ThÃ nh pháº§n | PhiÃªn báº£n cÅ© | Prefix cÅ© |
|---|---|---|
| go-zond (gzond) | v0.2.3 | `zond_*`, Z-prefix |
| @theqrl/web3 | v0.3.3 | `zond_*`, Z-prefix, `web3.zond.*` |
| QRL Wallet | v0.1.1 | `zond_*`, Z-prefix |

