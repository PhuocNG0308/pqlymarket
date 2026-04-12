# RPC Prefix Guide

The QRL 2.0 JSON-RPC uses a custom prefix (`qrl_`) to replace the default `eth_` found in EVM.

## Background
- Early in the development, `zond_` was used.
- To unify the brand, `qrl_` is now the standard for all QRL Zond 2.0 endpoints.
- The web3 library `@theqrl/web3` maps standard calls to these endpoints.

## Common Replacements

| Standard Ethereum JSON-RPC | QRL 2.0 Zond JSON-RPC | Notes |
|---|---|---|
| `eth_blockNumber` | `qrl_blockNumber` | Returns current highest block |
| `eth_getBalance` | `qrl_getBalance` | Check account balance |
| `eth_sendRawTransaction` | `qrl_sendRawTransaction` | Submit signed transaction |
| `eth_call` | `qrl_call` | Execute read-only contract function |
| `eth_gasPrice` | `qrl_gasPrice` | Estimate gas |

## Library Support
Due to this prefix change, standard tools like Ethers.js or Hardhat may fail if connected directly to the RPC. Hence, `@theqrl/web3` exists specifically to wrap requests in `qrl_`.

Always use `@theqrl/web3` when deploying or making raw calls to the QRL Testnet to avoid RPC prefix mismatch errors.