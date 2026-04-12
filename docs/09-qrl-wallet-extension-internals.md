# QRL Web3 Wallet Architecture & Internals

## Introduction
The QRL Web3 Wallet is a browser extension similar to MetaMask but created to support QRL 2.0 Zond with Post-Quantum secure features.

## Architecture

- **Background Script**: Manages the persistent state of the wallet and private keys securely.
- **Provider Injection**: Injects `window.qrl` securely into the web pages.
- **UI Components**: Rendered mostly in React/Tailwind for popup interaction (signing, approvals).

## Middleware Pipeline
When a dApp requests an RPC method:
1. Local checks routing standard EVM-like behaviors
2. Converting the DApp request into the appropriate `qrl_` scheme natively.
3. Prompting user confirmation for sending transactions
4. Executing XMSS or ML-DSA quantum-resistant signatures

## Post-Quantum Signatures
- Users can create unique ML-DSA-87 wallets through the extension.
- Transactions are serialized and hashed, then a quantum-resistant signature is generated locally.

## Development Setup for Integrators
- `window.qrl` implements a provider interface compatible with EIP-1193 structure but specifically mapped for QRL types.
- Ensure to check `window.qrl.isQRL` before initializing the web3 payload.