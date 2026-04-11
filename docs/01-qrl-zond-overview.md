# QRL 2.0 Zond Testnet - Overview

## Tổng quan

QRL 2.0 (Zond) là blockchain post-quantum secure, tương thích EVM. Đây là testnet V2 đang trong giai đoạn phát triển.

### Tính năng chính
- **Post-Quantum Security**: Bảo vệ ứng dụng khỏi tấn công lượng tử
- **EVM Compatibility**: Tích hợp với các tools Ethereum hiện có
- **Web3-Ready**: Xây dựng dApps thế hệ mới với bảo mật lượng tử
- **Developer-Friendly**: Sử dụng kỹ năng Ethereum sẵn có

### Chữ ký số (Post-Quantum Signature Schemes)
- **XMSS (Stateful)**: Bảo mật mạnh nhưng giới hạn số lượng signatures/wallet
- **ML-DSA-87 (Stateless)**: Không giới hạn số signatures, linh hoạt hơn (upgraded từ Dilithium 5 trong v0.3.0)
- ML-DSA bắt buộc cho staking validators
- Users có thể chọn XMSS hoặc ML-DSA cho general wallets

### Kiến trúc 2 Layer
- **Execution Layer**: `gqrl` (Golang implementation) — xử lý transactions, smart contracts, EVM
- **Consensus Layer**: `Qrysm` (dựa trên Prysm của Ethereum) — PoS consensus, beacon chain

### Network Params
- **Chain ID**: `32382`
- **RPC Proxy (recommended)**: `https://qrlwallet.com/api/qrl-rpc/testnet`
- **RPC Endpoint (local node)**: `http://localhost:8545`
- **Engine Endpoint (internal)**: `http://localhost:8551`
- **Beacon API (local node)**: `http://localhost:3500`

> **Lưu ý**: Khuyến nghị sử dụng RPC Proxy tại `https://qrlwallet.com/api/qrl-rpc/testnet` để kết nối Public Testnet mà không cần chạy node riêng. Nếu cần, có thể chạy Kurtosis private network cho local development.

### Smart Contract Compiler
- **Hyperion**: Fork của Solidity compiler cho Zond Virtual Machine (ZVM)
  - Repo: https://github.com/theQRL/hyperion
  - Sử dụng `pragma hyperion` thay vì `pragma solidity`
  - Dựa trên Solidity v0.8.23
  - Hỗ trợ address literal mới (prefix `Z` thay vì `0x`)
- **Hardhat + Solidity**: Cũng có thể dùng Hardhat với Solidity compiler tiêu chuẩn cho local development (tương thích EVM)

### Quan trọng cho Development
- QRL 2.0 sử dụng prefix `Z` thay vì `0x` cho addresses trong một số contexts
- JSON-RPC methods sử dụng prefix `qrl_` thay vì `eth_` (ví dụ: `qrl_blockNumber`, `qrl_getBalance`, `qrl_sendTransaction`)
- `@theqrl/web3` là Web3 library chính thức cho QRL Zond
- Tương thích EVM cho phép dùng Hardhat, ethers.js cho local dev/testing

## Repos chính của QRL 2.0

| Repo | Mục đích |
|------|----------|
| [go-qrl](https://github.com/theQRL/go-qrl) | Execution layer (gqrl) — v0.3.0 (Apr 2026). go-zond đã được rename thành go-qrl |
| [qrysm](https://github.com/theQRL/qrysm) | Consensus layer (beacon-chain, validator) — v0.2.2 tag, main branch active |
| [hyperion](https://github.com/theQRL/hyperion) | Hyperion compiler (fork Solidity cho ZVM) |
| [qrl-contract-example](https://github.com/theQRL/qrl-contract-example) | Smart contract example + deploy scripts (official docs link `zond-contract-example` nhưng redirect về đây) |
| [qrl-web3-wallet](https://github.com/theQRL/qrl-web3-wallet) | Web3 wallet extension (Chrome) |
| [go-qrl-metadata](https://github.com/theQRL/go-qrl-metadata) | Genesis files & testnet config |
| [hexseed-from-address](https://github.com/theQRL/hexseed-from-address) | Extract wallet hexseed |
| [qrl-package](https://github.com/theQRL/qrl-package) | Kurtosis private network package (⚠️ images đang có compatibility issues, chờ update) |
| [test-zond](https://github.com/theQRL/test-zond) | Testnet documentation source |

## Links tham chiếu
- Getting Started: https://test-zond.theqrl.org/testnet/get-started
- Installation: https://test-zond.theqrl.org/testnet/install/windows
- Running: https://test-zond.theqrl.org/testnet/running/windows
- Private Network: https://test-zond.theqrl.org/testnet/install/private-network
- Smart Contract Example: https://test-zond.theqrl.org/testnet/usage/contract-example
- dApp Example: https://github.com/theQRL/qrl-web3-wallet-dapp-example (⚠️ repo chưa tồn tại, 404)
- Discord: https://theqrl.org/discord
- GitHub: https://github.com/theQRL/test-zond

> **Cập nhật (2026-04)**: Documentation đang trong quá trình revision. Report issues qua Discord hoặc GitHub.
