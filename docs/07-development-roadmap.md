# PQlyMarket - Development Roadmap

## Phase 1: Foundation Setup âœ…
- [x] Setup project vá»›i QRL Zond network config (Chain ID 32382)
- [x] Ban Ä‘áº§u dÃ¹ng Hardhat + Solidity, sau Ä‘Ã³ chuyá»ƒn hoÃ n toÃ n sang Hyperion

## Phase 2: Smart Contracts âœ…
- [x] Viáº¿t `ConditionalToken.hyp` (ERC1155 â€” YES/NO tokens)
- [x] Viáº¿t `Oracle.hyp` (admin-controlled oracle)
- [x] Viáº¿t `PredictionMarket.hyp` (core market logic + constant-product AMM)
- [x] Viáº¿t `MarketFactory.hyp` (factory pattern + market groups)
- [x] Viáº¿t `PqlToken.hyp` (ERC20 governance token)
- [x] Viáº¿t `GovernanceOracle.hyp` (decentralized voting oracle)
- [x] Viáº¿t `Faucet.hyp` (testnet QRL faucet)
- [x] Implement base libraries thay tháº¿ OpenZeppelin: Ownable, ReentrancyGuard, ERC20, ERC1155
- [x] Compile thÃ nh cÃ´ng 16 contracts (9 deployable)

## Phase 3: Frontend MVP âœ…
- [x] Setup Next.js 16+ vá»›i TypeScript + Tailwind CSS
- [x] WalletProvider context + useWallet hook (ethers.js v6)
- [x] useMarkets hook (load, create, buy, resolve, claim)
- [x] WalletButton, CreateMarketForm, MarketList components
- [x] Trang chá»§: Header + Create Market + Active Markets

## Phase 4: QRL Zond Integration âœ…
- [x] Setup Docker local PoS network (gqrl v0.3.0 + qrysm beacon + validator)
- [x] Genesis generator with rebuilt qrysmctl from source (SSZ compatibility)
- [x] Block production verified â€” 12s slot time, 64 validators, blocks producing
- [x] Migrate hoÃ n toÃ n sang Hyperion compiler (`pragma hyperion ^0.0.2;`)
  - [x] XÃ³a Solidity/Hardhat, chá»‰ dÃ¹ng Hyperion
  - [x] `npm run compile` â†’ `artifacts/` (Hyperion only)
  - [x] `npm run deploy` â†’ QRL Zond deploy (@theqrl/web3)
  - [x] Táº¥t cáº£ 16 contracts compiled thÃ nh cÃ´ng, 9 deployable
- [x] Deploy script `deploy-qrl.js` load artifacts tá»« `artifacts/`
- [ ] Test deploy lÃªn Zond testnet v2 thá»±c táº¿
- [ ] TÃ­ch há»£p QRL Web3 Wallet Extension thá»±c táº¿
- [ ] TÃ­ch há»£p `@theqrl/web3` thay tháº¿ ethers.js trÃªn frontend

## Phase 5: Enhancement
- [ ] Cáº£i thiá»‡n AMM (LMSR hoáº·c CPMM nÃ¢ng cao)
- [ ] ThÃªm market categories & search
- [ ] Trang portfolio: Xem positions cá»§a user
- [ ] Admin panel riÃªng: Táº¡o market + resolve
- [ ] Mobile responsive UI
- [ ] Order book hoáº·c limit orders

## Phase 6: Production Ready
- [ ] Security audit cho smart contracts
- [ ] Gas optimization
- [ ] Monitoring & analytics
- [ ] Deploy lÃªn QRL 2.0 Mainnet (khi available)

## LÆ°u Ã½ quan trá»ng khi phÃ¡t triá»ƒn

1. **Hyperion only**: PQlyMarket sá»­ dá»¥ng Hyperion compiler (`pragma hyperion ^0.0.2;`)
   - `contracts/*.hyp` â€” Hyperion smart contracts
   - `npm run compile` â†’ `artifacts/`
   - `npm run deploy` â†’ QRL Zond deploy (@theqrl/web3)
2. **Web3 Library**: Sá»­ dá»¥ng `@theqrl/web3` (khÃ´ng dÃ¹ng ethers.js/Hardhat)
3. **RPC Methods**: Prefix `qrl_` thay vÃ¬ `eth_` (vÃ­ dá»¥: `qrl_sendTransaction`)
4. **Chain ID**: `32382` cho testnet
5. **Addresses**: QRL Zond dÃ¹ng prefix `Z` thay vÃ¬ `0x`
6. **Binaries cáº§n thiáº¿t**: `gqrl` (execution, go-qrl v0.3.0) + `beacon-chain` (consensus) + `validator`
7. **Docker images má»›i**: `qrledger/go-qrl:v0.3.0` (thay tháº¿ `qrledger/go-zond`), qrysm build from source
8. **Test QRL**: Xin qua Discord #testnet channel: https://theqrl.org/discord
9. **Hyperion compiler**: `@theqrl/hypc` npm package â€” khÃ´ng cáº§n build from source

