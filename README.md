# PQlyMarket

PQlyMarket is a decentralized prediction market platform (a Polymarket clone) built on the **QRL 2.0 Zond Testnet** - a post-quantum secure, EVM-compatible blockchain.

## What You Can Do
With PQlyMarket, users can:
- **Create Markets**: Launch new prediction markets on any future event.
- **Trade Outcomes**: Buy or sell conditional tokens (YES/NO) based on event probabilities using a constant-product Automated Market Maker (AMM).
- **Provide Liquidity**: Deposit tokens to facilitate market trading and earn fees.
- **Resolve Markets**: Use the oracle system to settle predictions accurately and securely on the Zond blockchain.
- **Claim QRL**: Receive testnet QRL tokens through the built-in Faucet contract.

---

## Getting Started & Interactive Commands

The following commands help you set up the environment, compile the smart contracts, and build/run the frontend that interacts with the QRL Zond blockchain.

### Prerequisites
- Node.js 18+
- [QRL Web3 Wallet Extension](https://github.com/theQRL/qrl-web3-wallet) 
- Testnet QRL (T-QRL) tokens (request via [QRL Discord](https://theqrl.org/discord))

### 1. Environment Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Important: Edit your new `.env` file with your deployer HEXSEED or private key.
```

### 2. Smart Contract & Blockchain Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Compiles the Hyperion smart contracts (`.hyp`) to Zond VM bytecode. |
| `npm run deploy` | Deploys the compiled contracts to QRL Zond Testnet and funds the faucet. |
| `npm run drain` | Recovers your locked funds from previously deployed contracts. |
| `npm run fill` | Sends tokens/funds into currently active contracts. |

### 3. Rebuilding & Running the Frontend

These commands allow you to build and interact with the frontend that connects directly to the blockchain.

| Command | Description |
|---------|-------------|
| `npm run build:frontend` | Installs frontend dependencies and builds the TypeScript & Tailwind CSS UI. |
| `npm run build` | Full workspace build: compiles smart contracts **and** rebuilds the frontend. |
| `npm run frontend:dev` | Runs the frontend development server (`tsx watch` and Tailwind `watch`). |
| `npm run dev` | **The Complete Workflow**: Compiles contracts, drains old funds, deploys new instances, and strictly launches the frontend dev server. |

*Alternatively, you can manually start the frontend:*
```bash
cd frontend
npm install
npm run dev # Starts development server natively on http://localhost:3000
npm run build # Rebuilds frontend TS & CSS
```

---

## Architecture & Smart Contracts

PQlyMarket relies on the following core smart contracts developed in Hyperion (`pragma hyperion ^0.0.2`):

| Contract | Purpose |
|----------|---------|
| **MarketFactory** | Factory to create new prediction markets and market groups. |
| **PredictionMarket** | Core market logic and Constant-product AMM. |
| **ConditionalToken** | ERC1155 tokens representing outcome positions (YES/NO). |
| **Oracle** | Admin/Decentralized oracle for resolving market outcomes. |

For detailed architecture logic, check [docs/06-polymarket-architecture.md](docs/06-polymarket-architecture.md).

## Documentation

Full QRL 2.0 Zond Network documentation can be found in the `docs/` directory:
- [QRL 2.0 Overview & Ecosystem](docs/01-qrl-zond-overview.md)
- [Hyperion Smart Contract Guide](docs/04-smart-contract-guide.md)
- [Polymarket Architecture](docs/06-polymarket-architecture.md)
- [Development Roadmap](docs/07-development-roadmap.md)

## Network Specification (QRL 2.0 Zond Testnet)

| Parameter | Value |
|-----------|-------|
| **Chain ID** | `32382` |
| **RPC Proxy (recommended)** | `https://rpc.pqlymarket.com/` |
| **Local Node RPC** | `http://localhost:8545` |
| **Web3 Library** | `@theqrl/web3` (Required for Post-Quantum signatures) |
| **RPC Prefix** | `qrl_` (Replaces Ethereum's `eth_` prefix) |

## License
MIT
