# PQlyMarket - Copilot Instructions

## Project Overview
PQlyMarket is a decentralized prediction market platform (Polymarket clone) built on QRL 2.0 Zond Testnet - a post-quantum secure, EVM-compatible blockchain.

## Tech Stack
- **Smart Contracts**: Hyperion ^0.0.2 (QRL's Solidity fork), compiled via `@theqrl/hypc`
- **Web3 Library**: `@theqrl/web3` for all blockchain interactions
- **Frontend**: Express + EJS + TypeScript + Tailwind CSS
- **Blockchain**: QRL 2.0 Zond Testnet (Chain ID: 32382)
  - RPC Proxy (recommended): https://rpc.pqlymarket.com/
  - Local Zond node (gqrl): http://localhost:8545
- **Wallet**: QRL Web3 Wallet Extension

## QRL 2.0 Zond Specifics
- **Hyperion**: QRL's fork of Solidity compiler for Zond VM. Uses `pragma hyperion` instead of `pragma solidity`. Repo: https://github.com/theQRL/hyperion
- JSON-RPC methods use `qrl_` prefix instead of `eth_` (e.g., `qrl_blockNumber`, `qrl_sendTransaction`)
- Addresses use `Q` prefix instead of `0x` on Zond (e.g., `Q20fe5d...`)
- Chain ID is `32382` for testnet
- Post-quantum signature schemes: XMSS (stateful) and ML-DSA-87 (stateless, upgraded from Dilithium 5)

## Smart Contract Architecture
All contracts are written in Hyperion (`pragma hyperion ^0.0.2;`) in `contracts/*.hyp`:

### Base Libraries (replacing OpenZeppelin â€” not available for Hyperion)
- `Ownable.hyp`, `ReentrancyGuard.hyp`
- `ERC20.hyp`, `IERC20.hyp`
- `ERC1155.hyp`, `IERC1155.hyp`, `IERC165.hyp`, `IERC1155Receiver.hyp`

### Application Contracts
1. **MarketFactory.hyp** - Factory to create new prediction markets + market groups
2. **PredictionMarket.hyp** - Core market logic with constant-product AMM
3. **ConditionalToken.hyp** - ERC1155 tokens representing outcome positions (YES/NO)
4. **Oracle.hyp** - Simple admin-controlled oracle for resolving market outcomes
5. **PqlToken.hyp** - ERC20 governance token
6. **GovernanceOracle.hyp** - Decentralized voting oracle
7. **Faucet.hyp** - Testnet QRL distribution
8. **IOracle.hyp** - Oracle interface

### Build & Deploy
- Compile: `npm run compile` â†’ `artifacts/`
- Deploy: `npm run deploy` (uses `@theqrl/web3`)

## Coding Conventions
- Use TypeScript for all frontend code
- Use Hyperion ^0.0.2 with explicit visibility modifiers
- Base ERC standards implemented inline (no OpenZeppelin in Hyperion ecosystem)
- Frontend contract addresses configured in `frontend/src/config/contracts.ts`
- Use environment variables for sensitive data (hexseed, private keys)
- Never hardcode wallet credentials

## Project Structure
```
PQlyMarket/
â”œâ”€â”€ contracts/          # Hyperion smart contracts (.hyp)
â”‚   â”œâ”€â”€ Ownable.hyp, ReentrancyGuard.hyp, ERC20.hyp, ERC1155.hyp  # Base libs
â”‚   â”œâ”€â”€ ConditionalToken.hyp, PredictionMarket.hyp, MarketFactory.hyp  # App
â”‚   â””â”€â”€ Oracle.hyp, GovernanceOracle.hyp, PqlToken.hyp, Faucet.hyp    # App
â”œâ”€â”€ artifacts/          # Hyperion compiled artifacts (ABI + bytecode)
â”œâ”€â”€ scripts/            # Compile + deploy scripts
â”‚   â”œâ”€â”€ deploy-qrl.js   # QRL Zond deploy (@theqrl/web3)
â”‚   â””â”€â”€ hyp-compile.js  # Hyperion compiler script (@theqrl/hypc)
â”œâ”€â”€ frontend/           # Express + EJS frontend app
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ config/     # contracts.ts
â”‚       â”œâ”€â”€ routes/     # api.ts, index.ts
â”‚       â”œâ”€â”€ services/   # blockchain.ts
â”‚       â””â”€â”€ types/      # index.ts
â”œâ”€â”€ docs/               # QRL 2.0 reference documentation
â”œâ”€â”€ deployment.json     # Deployed contract addresses
â””â”€â”€ .github/            # Copilot instructions
```

## Documentation Reference
All QRL 2.0 Zond documentation is in the `docs/` folder:
- `docs/01-qrl-zond-overview.md` - Platform overview, repos, Hyperion info
- `docs/04-smart-contract-guide.md` - Hyperion smart contract development guide
- `docs/08-rpc-prefix-guide.md` - RPC prefix guide (qrl_* is current standard)
- `docs/06-polymarket-architecture.md` - System architecture
- `docs/07-development-roadmap.md` - Development phases (with completion status)
- `docs/09-qrl-wallet-extension-internals.md` - QRL Web3 Wallet architecture, middleware pipeline, method prefixes
- `docs/10-compatibility-audit.md` - End-to-end compatibility audit (contractsâ†”walletâ†”proxyâ†”frontendâ†”chain)

## Key External Resources
- **Hyperion Compiler**: https://github.com/theQRL/hyperion
- **QRL Contract Example**: https://github.com/theQRL/qrl-contract-example (official docs link as `zond-contract-example`, redirects here)
- **go-qrl**: https://github.com/theQRL/go-qrl (v0.3.0, renamed from go-zond; go-zond redirects here)
- **Qrysm**: https://github.com/theQRL/qrysm
- **QRL Web3 Wallet**: https://github.com/theQRL/qrl-web3-wallet
- **Testnet Docs**: https://test-zond.theqrl.org/testnet/get-started
- **Discord (for test QRL)**: https://theqrl.org/discord
