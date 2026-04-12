# PQlyMarket Architecture

## Overview
PQlyMarket is a decentralized prediction market built on QRL 2.0 Zond. It is a full-stack dApp utilizing the QRL post-quantum secure blockchain for settlement and state management.

## Components
1. **Smart Contracts (Hyperion)**
   - Deployed on QRL 2.0 Zond Testnet.
   - Core files: MarketFactory, PredictionMarket, ConditionalToken.
2. **Backend Services**
   - Express server providing REST APIs for frontend.
   - RPC Proxy for simplifying interactions with the QRL node.
3. **Frontend Application**
   - Built with EJS and compiled Tailwind CSS.
   - Interacts with contracts via `@theqrl/web3` and the QRL Web3 Wallet.

## Data Flow
- Users connect their QRL Web3 Wallet.
- Transactions are signed and broadcasted to the QRL node via the RPC Proxy.
- Smart contracts emit events upon execution.
- The backend listens to these events or queries the state to update the UI.

## Post-Quantum Security
- Accounts are safeguarded by ML-DSA/XMSS signatures.
- Replay protection is inherited from the EVM layer inside QRL Zond.