---
description: "Use when: writing Hyperion smart contracts, deploying contracts, or interacting with QRL 2.0 Zond blockchain. Use for: prediction market contracts, ERC1155 tokens, AMM logic, factory patterns."
applyTo: "contracts/**,scripts/**"
---

# QRL Zond Smart Contract Development

## QRL 2.0 Zond Network Configuration
- **Public Testnet (via RPC Proxy)**: Chain ID 32382 (0x7e7e), RPC https://rpc.pqlymarket.com/
- **Local Docker (dev)**: Chain ID 32383 (0x7e7f), RPC http://127.0.0.1:8545
- Web3 Library: `@theqrl/web3` (required instead of standard web3/ethers)
- Always use `process.env.RPC_URL` so the endpoint is configurable

## RPC Prefix Guide
All contexts now use the `qrl_*` prefix:

| Context | Prefix | Example |
|---------|--------|---------|
| **gqrl node** (go-qrl v0.3.0) | `qrl_` | `qrl_sendTransaction`, `qrl_call` |
| **QRL Web3 Wallet** (current) | `qrl_` | DApp sends `qrl_requestAccounts` |
| **QRL Wallet v0.1.1** (legacy) | `zond_` | DApp sends `zond_requestAccounts` |
| **@theqrl/web3 v0.4.0** | `qrl_` | Library sends `qrl_*` to node |

The wallet extension and @theqrl/web3 v0.4.0 both use `qrl_*` natively. No proxy/translation is needed between wallet and node. See `docs/09-qrl-wallet-extension-internals.md` for full architecture.

## Hyperion Contract Pipeline
- Source: `contracts/*.hyp`
- Pragma: `pragma hyperion ^0.0.2;`
- Compiler: `@theqrl/hypc` via `scripts/hyp-compile.js`
- Artifacts: `artifacts/*.json` (fields: `contractName`, `abi`, `bytecode`)
- Bytecode field: `bytecode` (NOT `zvm.bytecode.object`)
- Compile: `npm run compile`
- Deploy: `npm run deploy`
- No OpenZeppelin — base libs (ERC20, ERC1155, Ownable, ReentrancyGuard) implemented inline in `contracts/`
- Imports use `.hyp` extension: `import "./ERC20.hyp";`

## Contract Deploy Pattern (QRL Zond)
```javascript
const Web3 = require('@theqrl/web3');
const web3 = new Web3(process.env.RPC_URL || 'https://rpc.pqlymarket.com/');

// Load artifact
const artifact = require('../artifacts/MyContract.json');

// Deploy contract
const contract = new web3.qrl.Contract(artifact.abi);
const deploy = contract.deploy({ data: artifact.bytecode, arguments: [...] });
const gas = await deploy.estimateGas();
const tx = await deploy.send({ from: account, gas });
```

## Hyperion Requirements
- Use `pragma hyperion ^0.0.2;`
- File extension `.hyp`
- No OpenZeppelin — use inline base libraries in `contracts/`
- Compiler input: `language: "Hyperion"` in standard JSON
- Always use ReentrancyGuard for functions that transfer funds
- Emit events for all state changes

## Prediction Market Contract Pattern
- MarketFactory creates PredictionMarket instances (via `new PredictionMarket(...)`)
- Each market has YES/NO outcome tokens (ERC1155 via ConditionalToken)
- AMM uses constant product formula
- Oracle resolves markets (admin-controlled for MVP, GovernanceOracle for decentralized)
- Users claim winnings by burning winning tokens
- Gas estimate for createMarket: ~1.86M (use 4x buffer for nested CREATE opcodes)
