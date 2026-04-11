# Smart Contract trÃªn QRL 2.0 Zond

> Sources:
> - https://github.com/theQRL/qrl-contract-example (official example)
> - https://github.com/theQRL/hyperion (Hyperion compiler)
> - https://test-zond.theqrl.org/testnet/usage/contract-example

## Overview

QRL 2.0 tÆ°Æ¡ng thÃ­ch EVM, cho phÃ©p deploy smart contracts lÃªn Zond Virtual Machine (ZVM).

### Hai cÃ¡ch phÃ¡t triá»ƒn Smart Contract:

1. **Hyperion (QRL native)** â€” **PQlyMarket sá»­ dá»¥ng cÃ¡ch nÃ y**:
   - Sá»­ dá»¥ng `pragma hyperion ^0.0.2;`
   - File extension `.hyp`
   - Compiler: `@theqrl/hypc` (npm package)
   - Bytecode output: `zvm.bytecode.object`
   - DÃ¹ng vá»›i `@theqrl/web3` library
   - Source code táº¡i `contracts/`
   - Compile: `npm run compile` â†’ output táº¡i `artifacts/`

2. **Hardhat + Solidity (EVM compatible)** â€” khÃ´ng sá»­ dá»¥ng:
   - PQlyMarket Ä‘Ã£ chuyá»ƒn hoÃ n toÃ n sang Hyperion
   - Hardhat khÃ´ng cÃ²n Ä‘Æ°á»£c sá»­ dá»¥ng

## Hyperion Compiler

Hyperion lÃ  ngÃ´n ngá»¯ láº­p trÃ¬nh smart contract cá»§a QRL, fork tá»« Solidity v0.8.23:

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

### KhÃ¡c biá»‡t so vá»›i Solidity

| Feature | Solidity | Hyperion |
|---------|----------|----------|
| Pragma | `pragma solidity ^0.8.27;` | `pragma hyperion ^0.0.2;` |
| File extension | `.sol` | `.hyp` |
| Compiler | `solc` | `@theqrl/hypc` |
| Compiler input language | `"Solidity"` | `"Hyperion"` |
| Bytecode output | `evm.bytecode.object` | `zvm.bytecode.object` |
| Import paths | `import "./File.sol";` | `import "./File.hyp";` |
| OpenZeppelin | CÃ³ sáºµn | Pháº£i implement tá»« Ä‘áº§u |
| Syntax | â€” | Giá»‘ng há»‡t Solidity |

## PQlyMarket Hyperion Contracts

PQlyMarket sá»­ dá»¥ng Hyperion cho toÃ n bá»™ contracts táº¡i `contracts/`:

### Base Libraries (thay tháº¿ OpenZeppelin)
- `Ownable.hyp` â€” Access control (owner pattern)
- `ReentrancyGuard.hyp` â€” Chá»‘ng reentrancy attack
- `ERC20.hyp` + `IERC20.hyp` â€” Token standard
- `ERC1155.hyp` + `IERC1155.hyp` + `IERC1155Receiver.hyp` + `IERC165.hyp` â€” Multi-token standard

### Application Contracts
- `ConditionalToken.hyp` â€” ERC1155 YES/NO outcome tokens
- `PqlToken.hyp` â€” ERC20 governance token (PQL)
- `Oracle.hyp` â€” Admin-controlled oracle
- `GovernanceOracle.hyp` â€” Decentralized voting oracle
- `PredictionMarket.hyp` â€” AMM-based binary market
- `MarketFactory.hyp` â€” Factory + market groups
- `Faucet.hyp` â€” Testnet QRL faucet
- `IOracle.hyp` â€” Oracle interface

### Compile & Deploy

```bash
# Compile Hyperion contracts
npm run compile

# Deploy lên Zond testnet (via RPC Proxy)
HEXSEED=0x... npm run deploy

# Hoặc chỉ định RPC URL rõ ràng
HEXSEED=0x... RPC_URL=https://qrlwallet.com/api/qrl-rpc/testnet npm run deploy
```

## Official QRL Contract Example (Hyperion approach)

### Step 1: CÃ i Ä‘áº·t & Cháº¡y Zond Node
Theo hÆ°á»›ng dáº«n táº¡i [02-windows-install.md](./02-windows-install.md) vÃ  [03-running-windows.md](./03-running-windows.md)

### Step 2: Táº¡o Wallet & Láº¥y Test QRL
- Sá»­ dá»¥ng QRL Web3 Wallet Extension: https://github.com/theQRL/qrl-web3-wallet
- Láº¥y test QRL qua Discord #testnet channel: https://theqrl.org/discord
- Tool extract hexseed: https://github.com/theQRL/hexseed-from-address
  ```bash
  npm i -g @theqrl/hexseed-from-address
  hexseed-from-address -p SecretPassword123 -a 0x<your_address> -d ~/gqrldata
  ```

### Step 3: Cáº¥u hÃ¬nh config.json
```json
{
  "provider": "https://qrlwallet.com/api/qrl-rpc/testnet",
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

Káº¿t quáº£ sáº½ cÃ³ `contractAddress` dáº¡ng `Zecf54b758c2793466FD...` (prefix `Z`).

### Step 5: Interact
```bash
node 2-onchain-call.js    # On-chain call (costs gas)
node 3-offchain-call.js   # Off-chain call (free, read-only)
```

## Contract Example Structure (qrl-contract-example)
```
qrl-contract-example/
â”œâ”€â”€ contracts/           # Smart contracts (Hyperion syntax)
â”œâ”€â”€ config.json          # Node connection & wallet config
â”œâ”€â”€ contract-compiler.js # Compile contracts using solc
â”œâ”€â”€ 1-deploy.js          # Deploy contract to Zond chain
â”œâ”€â”€ 2-onchain-call.js    # Make on-chain transaction
â”œâ”€â”€ 3-offchain-call.js   # Make off-chain (read) call
â”œâ”€â”€ getcode.js           # Get deployed bytecode
â””â”€â”€ package.json         # Dependencies (solc, web3-eth-abi, etc.)
```

## Key Dependencies (qrl-contract-example / PQlyMarket Hyperion)
- `@theqrl/hypc` â€” Hyperion compiler (npm, replaces solc)
- `@theqrl/web3` â€” QRL Web3 library for deployment & interaction
- Node.js 18+

> PQlyMarket sá»­ dá»¥ng `@theqrl/hypc` trá»±c tiáº¿p qua `scripts/hyp-compile.js`,
> khÃ´ng cáº§n build Hyperion compiler from source.

## PQlyMarket Build & Deploy

```bash
# Compile Hyperion contracts (.hyp â†’ artifacts/)
npm run compile

# Deploy to Zond testnet (via RPC Proxy — mặc định)
HEXSEED=0x... npm run deploy

# Hoặc chỉ định RPC URL
HEXSEED=0x... RPC_URL=https://qrlwallet.com/api/qrl-rpc/testnet npm run deploy
```

Xem chi tiáº¿t táº¡i [deployment.json](../deployment.json).

## So sÃ¡nh Hyperion vs Solidity

| Feature | Hyperion (PQlyMarket) | Solidity |
|---------|----------------------|----------|
| Compiler | `@theqrl/hypc` (`pragma hyperion ^0.0.2;`) | solc (`pragma solidity`) |
| File ext | `.hyp` | `.sol` |
| Source dir | `contracts/` | â€” |
| Artifact dir | `artifacts/` | â€” |
| Compile cmd | `npm run compile` | â€” |
| Deploy cmd | `npm run deploy` | â€” |
| Web3 | `@theqrl/web3` | ethers.js / web3.js |
| Addresses | `Z` prefix | `0x` prefix |
| OpenZeppelin | Inline implementations | npm package |
| Network | QRL Zond testnet v2 | Ethereum |

