# Smart Contracts on QRL 2.0 Zond

> Sources:
> - https://github.com/theQRL/qrl-contract-example (official example)
> - https://github.com/theQRL/hyperion (Hyperion compiler)
> - https://test-zond.theqrl.org/testnet/usage/contract-example

## Overview

QRL 2.0 is EVM-compatible, allowing deployment of smart contracts onto the Zond Virtual Machine (ZVM).

### Two Approaches for Smart Contract Development:

1. **Hyperion (QRL native)** — **PQlyMarket uses this approach**:
   - Uses `pragma hyperion ^0.0.2;`
   - File extension `.hyp`
   - Compiler: `@theqrl/hypc` (npm package)
   - Bytecode output: `zvm.bytecode.object`
   - Used with `@theqrl/web3` library
   - Source code in `contracts/`
   - Compile: `npm run compile` → output in `artifacts/`

2. **Hardhat + Solidity (EVM compatible)** — not used:
   - PQlyMarket has completely transitioned to Hyperion
   - Hardhat is no longer used

## Hyperion Compiler

Hyperion is QRL's smart contract programming language, forked from Solidity v0.8.23:
- **Repo**: https://github.com/theQRL/hyperion
- **npm**: `@theqrl/hypc@^0.0.2`
- **Language**: Statically-typed, curly-braces, contract-oriented
- **Target**: Zond Virtual Machine (ZVM)
- **pragma**: `pragma hyperion ^0.0.2;`

```hyperion
// SPDX-License-Identifier: MIT
pragma hyperion ^0.0.2;

contract HelloWorld {
    function helloWorld() external pure returns (string memory) {
        return "Hello, World!";
    }
}
```

### Differences from Solidity

| Feature | Solidity | Hyperion |
|---------|----------|----------|
| Pragma | `pragma solidity ^0.8.27;` | `pragma hyperion ^0.0.2;` |
| File extension | `.sol` | `.hyp` |
| Compiler | `solc` | `@theqrl/hypc` |
| Compiler input language | `"Solidity"` | `"Hyperion"` |
| Bytecode output | `evm.bytecode.object` | `zvm.bytecode.object` |
| Import paths | `import "./File.sol";` | `import "./File.hyp";` |
| OpenZeppelin | Available | Must be implemented from scratch |
| Syntax | — | Identical to Solidity |

## PQlyMarket Hyperion Contracts

PQlyMarket uses Hyperion for all contracts in `contracts/`:

### Base Libraries (replacing OpenZeppelin)
- `Ownable.hyp` — Access control (owner pattern)
- `ReentrancyGuard.hyp` — Prevents reentrancy attacks
- `ERC20.hyp` + `IERC20.hyp` — Token standard
- `ERC1155.hyp` + `IERC1155.hyp` + `IERC1155Receiver.hyp` + `IERC165.hyp` — Multi-token standard

### Application Contracts
- `ConditionalToken.hyp` — ERC1155 YES/NO outcome tokens
- `PqlToken.hyp` — ERC20 governance token (PQL)
- `Oracle.hyp` — Admin-controlled oracle
- `GovernanceOracle.hyp` — Decentralized voting oracle
- `PredictionMarket.hyp` — AMM-based binary market
- `MarketFactory.hyp` — Factory + market groups
- `Faucet.hyp` — Testnet QRL faucet
- `IOracle.hyp` — Oracle interface

### Compile & Deploy

```bash
# Compile Hyperion contracts
npm run compile

# Deploy to Zond testnet (via RPC Proxy)
HEXSEED=0x... npm run deploy

# Or specify RPC URL explicitly
HEXSEED=0x... RPC_URL=https://qrlwallet.com/api/qrl-rpc/testnet/ npm run deploy
```

## Official QRL Contract Example (Hyperion approach)

### Step 1: Install & Run Zond Node
Follow the instructions at [02-windows-install.md](./02-windows-install.md) and [03-running-windows.md](./03-running-windows.md)

### Step 2: Create Wallet & Get Test QRL
- Use QRL Web3 Wallet Extension: https://github.com/theQRL/qrl-web3-wallet
- Get test QRL via Discord #testnet channel: https://theqrl.org/discord
- Hexseed extraction tool: https://github.com/theQRL/hexseed-from-address
  ```bash
  npm i -g @theqrl/hexseed-from-address
  hexseed-from-address -p SecretPassword123 -a 0x<your_address> -d ~/gqrldata
  ```

### Step 3: Configure config.json
```json
{
  "provider": "https://qrlwallet.com/api/qrl-rpc/testnet/",
  "hexseed": "0x<your_hexseed>",
  "contract_address": "contract_address_here",
  "tx_required_confirmations": 12
}
```

### Step 4: Clone & Deploy
```bash
git clone https://github.com/theQRL/qrl-contract-example.git
cd qrl-contract-example
nvm use
npm install
node 1-deploy.js
```

The result will have a `contractAddress` like `Zecf54b758c2793466FD...` (prefix `Z`).

### Step 5: Interact
```bash
node 2-onchain-call.js    # On-chain call (costs gas)
node 3-offchain-call.js   # Off-chain call (free, read-only)
```

## Contract Example Structure (qrl-contract-example)
```
qrl-contract-example/
├── contracts/           # Smart contracts (Hyperion syntax)
├── config.json          # Node connection & wallet config
├── contract-compiler.js # Compile contracts using solc
├── 1-deploy.js          # Deploy contract to Zond chain
├── 2-onchain-call.js    # Make on-chain transaction
├── 3-offchain-call.js   # Make off-chain (read) call
├── getcode.js           # Get deployed bytecode
└── package.json         # Dependencies (solc, web3-eth-abi, etc.)
```

## Key Dependencies (qrl-contract-example / PQlyMarket Hyperion)
- `@theqrl/hypc` — Hyperion compiler (npm, replaces solc)
- `@theqrl/web3` — QRL Web3 library for deployment & interaction
- Node.js 18+

> PQlyMarket uses `@theqrl/hypc` directly via `scripts/hyp-compile.js`,
> no need to build the Hyperion compiler from source.

## PQlyMarket Build & Deploy

```bash
# Compile Hyperion contracts (.hyp → artifacts/)
npm run compile

# Deploy to Zond testnet (via RPC Proxy — default)
HEXSEED=0x... npm run deploy

# Or specify RPC URL
HEXSEED=0x... RPC_URL=https://qrlwallet.com/api/qrl-rpc/testnet/ npm run deploy
```

See details in [deployment.json](../deployment.json).

## Hyperion vs Solidity Comparison

| Feature | Hyperion (PQlyMarket) | Solidity |
|---------|----------------------|----------|
| Compiler | `@theqrl/hypc` (`pragma hyperion ^0.0.2;`) | solc (`pragma solidity`) |
| File ext | `.hyp` | `.sol` |
| Source dir | `contracts/` | — |
| Artifact dir | `artifacts/` | — |
| Compile cmd | `npm run compile` | — |
| Deploy cmd | `npm run deploy` | — |
| Web3 | `@theqrl/web3` | ethers.js / web3.js |
| Addresses | `Z` prefix | `0x` prefix |
| OpenZeppelin | Inline implementations | npm package |
| Network | QRL Zond testnet v2 | Ethereum |
