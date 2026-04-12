# QRL 2.0 Zond Testnet - Overview

## Overview

QRL 2.0 (Zond) is a post-quantum secure, EVM-compatible blockchain. This is the V2 testnet currently in development.

### Key Features
- **Post-Quantum Security**: Protects applications from quantum computing attacks.
- **EVM Compatibility**: Integrates with existing Ethereum tools.
- **Web3-Ready**: Build next-generation dApps with quantum security.
- **Developer-Friendly**: Leverage your existing Ethereum development skills.

### Post-Quantum Signature Schemes
- **XMSS (Stateful)**: Strong security but limited number of signatures/wallet.
- **ML-DSA-87 (Stateless)**: Unlimited signatures, highly flexible (upgraded from Dilithium 5 in v0.3.0).
- ML-DSA is mandatory for staking validators.
- Users can choose either XMSS or ML-DSA for general wallets.

### 2-Layer Architecture
- **Execution Layer**: `gqrl` (Golang implementation) — handles transactions, smart contracts, and EVM.
- **Consensus Layer**: `Qrysm` (based on Ethereum's Prysm) — PoS consensus, beacon chain.

### Network Params
- **Chain ID**: `32382`
- **RPC Proxy (recommended)**: `https://rpc.pqlymarket.com/`
- **RPC Endpoint (local node)**: `http://localhost:8545`
- **Engine Endpoint (internal)**: `http://localhost:8551`
- **Beacon API (local node)**: `http://localhost:3500`

> **Note**: It is recommended to use the RPC Proxy at `https://rpc.pqlymarket.com/` to connect to the Public Testnet without running your own node. If necessary, you can run a Kurtosis private network for local development.

### Smart Contract Compiler
- **Hyperion**: Fork of the Solidity compiler for the Zond Virtual Machine (ZVM).
  - Repo: https://github.com/theQRL/hyperion
  - Uses `pragma hyperion` instead of `pragma solidity`.
  - Based on Solidity v0.8.23.
  - Supports new address literals (prefix `Z` instead of `0x`).
- **Hardhat + Solidity**: You can also use Hardhat with the standard Solidity compiler for local development (EVM compatible).

### Important for Development
- QRL 2.0 uses the `Z` prefix instead of `0x` for addresses in certain contexts.
- JSON-RPC methods use the `qrl_` prefix instead of `eth_` (e.g., `qrl_blockNumber`, `qrl_getBalance`, `qrl_sendTransaction`).
- `@theqrl/web3` is the official Web3 library for QRL Zond.
- EVM compatibility allows using Hardhat and ethers.js for local dev/testing.

## Main QRL 2.0 Repositories

| Repo | Purpose |
|------|----------|
| [go-qrl](https://github.com/theQRL/go-qrl) | Execution layer (gqrl) — v0.3.0 (Apr 2026). go-zond has been renamed to go-qrl |
| [qrysm](https://github.com/theQRL/qrysm) | Consensus layer (beacon-chain, validator) — v0.2.2 tag, main branch active |
| [hyperion](https://github.com/theQRL/hyperion) | Hyperion compiler (Solidity fork for ZVM) |
| [qrl-contract-example](https://github.com/theQRL/qrl-contract-example) | Smart contract example + deploy scripts (official docs link `zond-contract-example` but redirects here) |
| [qrl-web3-wallet](https://github.com/theQRL/qrl-web3-wallet) | Web3 wallet extension (Chrome) |
| [go-qrl-metadata](https://github.com/theQRL/go-qrl-metadata) | Genesis files & testnet config |
| [hexseed-from-address](https://github.com/theQRL/hexseed-from-address) | Extract wallet hexseed |
| [qrl-package](https://github.com/theQRL/qrl-package) | Kurtosis private network package (⚠️ images have compatibility issues, pending update) |
| [test-zond](https://github.com/theQRL/test-zond) | Testnet documentation source |

## Reference Links
- Getting Started: https://test-zond.theqrl.org/testnet/get-started
- Installation: https://test-zond.theqrl.org/testnet/install/windows
- Running: https://test-zond.theqrl.org/testnet/running/windows
- Private Network: https://test-zond.theqrl.org/testnet/install/private-network
- Smart Contract Example: https://test-zond.theqrl.org/testnet/usage/contract-example
- dApp Example: https://github.com/theQRL/qrl-web3-wallet-dapp-example (⚠️ repo does not exist, 404)
- Discord: https://theqrl.org/discord
- GitHub: https://github.com/theQRL/test-zond

> **Update (2026-04)**: Documentation is currently undergoing revision. Report issues via Discord or GitHub.
