# PQlyMarket

Decentralized prediction market (Polymarket clone) built on **QRL 2.0 Zond Testnet** - post-quantum secure, EVM-compatible blockchain.

## Quick Start

### Prerequisites
- Node.js 18+
- QRL Web3 Wallet Extension (Chrome)
- Test QRL tokens (request via [Discord](https://theqrl.org/discord))

### Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your deployer HEXSEED

# Compile contracts (Hyperion)
npm run compile

# Deploy to QRL Zond Testnet
npm run deploy

# Or run the full dev workflow (compile → drain old → deploy → frontend)
npm run dev
```

### Scripts
| Command | Description |
|---------|-------------|
| `npm run compile` | Compile Hyperion contracts |
| `npm run deploy` | Deploy contracts (funds faucet with 40,000 QRL, 400 QRL/claim) |
| `npm run drain` | Recover funds from previously deployed contracts |
| `npm run dev` | Full workflow: compile → drain → deploy → start frontend |

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Architecture

See [docs/06-polymarket-architecture.md](docs/06-polymarket-architecture.md) for full architecture details.

| Contract | Purpose |
|----------|---------|
| MarketFactory | Create prediction markets |
| PredictionMarket | Core market logic + AMM |
| ConditionalToken | ERC1155 outcome tokens |
| Oracle | Resolve market outcomes |

## Documentation

All reference docs are in `docs/`:
- [QRL 2.0 Overview](docs/01-qrl-zond-overview.md)
- [Smart Contract Guide](docs/04-smart-contract-guide.md)
- [Architecture](docs/06-polymarket-architecture.md)
- [Roadmap](docs/07-development-roadmap.md)

## QRL 2.0 Zond Network

| Parameter | Value |
|-----------|-------|
| Chain ID | 32382 |
| **RPC Proxy (recommended)** | **https://qrlwallet.com/api/qrl-rpc/testnet** |
| Local RPC (own node) | http://localhost:8545 |
| Web3 Library | `@theqrl/web3` |
| RPC Prefix | `qrl_` (not `eth_`) |

## License

MIT
