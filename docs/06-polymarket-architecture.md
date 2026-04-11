# PQlyMarket - Prediction Market Architecture (Polymarket Clone trên QRL 2.0)

## Tổng quan hệ thống

PQlyMarket là nền tảng prediction market phi tập trung chạy trên QRL 2.0 Zond Testnet, cho phép người dùng đặt cược vào kết quả của các sự kiện.

## Kiến trúc

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│         (Next.js / React + TypeScript)       │
│    Kết nối QRL Web3 Wallet Extension         │
└──────────────────┬──────────────────────────┘
                   │ @theqrl/web3
┌──────────────────▼──────────────────────────┐
│              Smart Contracts                 │
│           (Solidity / EVM Compatible)        │
│                                              │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │ MarketFactory    │  │ ConditionalToken │  │
│  │ (Tạo markets)   │  │ (ERC1155 tokens) │  │
│  └─────────────────┘  └──────────────────┘  │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Market           │  │ Oracle           │  │
│  │ (Mua/bán shares)│  │ (Resolve kết quả)│  │
│  └─────────────────┘  └──────────────────┘  │
└──────────────────┬──────────────────────────┘
                   │ JSON-RPC (qrl_ prefix)
┌──────────────────▼──────────────────────────┐
│           QRL 2.0 Zond Testnet               │
│    gqrl (Execution) + Qrysm (Consensus)     │
│    Chain ID: 32382 | RPC Proxy: qrlwallet.com     │
└──────────────────────────────────────────────┘
```

## Smart Contracts cần xây dựng

### 1. MarketFactory.sol
- Tạo prediction markets mới
- Lưu danh sách tất cả markets
- Emit events khi market được tạo

### 2. PredictionMarket.sol
- Core logic cho mỗi market
- Mua/bán outcome shares (YES/NO)
- AMM (Automated Market Maker) đơn giản
- Resolve market khi kết quả được xác định
- Claim winnings

### 3. ConditionalToken.sol (ERC1155)
- Token đại diện cho các outcome positions
- Mỗi market có YES token và NO token
- Transferable giữa users

### 4. Oracle.sol
- Oracle đơn giản (admin-controlled cho MVP)
- Resolve kết quả sự kiện
- Có thể nâng cấp lên decentralized oracle sau

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.27 (Hardhat local) / Hyperion (Zond production) |
| Contract Tooling | Hardhat 2.22+ (compile, test, deploy) |
| Contract Standards | OpenZeppelin v5 (ERC1155, Ownable, ReentrancyGuard) |
| EVM Version | Cancun (required for OZ v5 mcopy) |
| Web3 (Frontend) | ethers.js v6 (local dev) / `@theqrl/web3` (Zond production) |
| Frontend | Next.js 16+ / React 19+ / TypeScript |
| Styling | Tailwind CSS |
| Wallet | MetaMask (local dev) / QRL Web3 Wallet Extension (Zond) |
| Testing | Hardhat local network (Chain ID 32382) |
| QRL Node | gqrl (execution) + Qrysm beacon-chain (consensus) |

## Flow chính

### Tạo Market
1. Admin gọi `MarketFactory.createMarket(question, outcomes, endTime)`
2. Factory deploy `PredictionMarket` contract mới
3. Frontend hiển thị market mới

### Đặt cược (Buy Shares)
1. User kết nối QRL Web3 Wallet
2. User chọn market → chọn outcome (YES/NO)
3. User approve QRL token → gọi `market.buy(outcome, amount)`
4. Market mint ERC1155 tokens cho user
5. Giá tự động điều chỉnh theo AMM curve

### Resolve Market
1. Oracle/Admin gọi `market.resolve(winningOutcome)` sau khi sự kiện kết thúc
2. Market chuyển sang trạng thái RESOLVED

### Claim Winnings
1. User giữ winning outcome tokens
2. Gọi `market.claim()` để nhận QRL tokens
3. Shares được burn, QRL được chuyển

## Cấu trúc thư mục dự kiến

```
PQlyMarket/
├── contracts/                # Solidity smart contracts
│   ├── MarketFactory.sol
│   ├── PredictionMarket.sol
│   ├── ConditionalToken.sol
│   └── Oracle.sol
├── scripts/                  # Deploy & interaction scripts
│   ├── deploy.js
│   └── interact.js
├── test/                     # Contract tests
│   ├── MarketFactory.test.js
│   └── PredictionMarket.test.js
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── package.json
│   └── next.config.js
├── docs/                     # Documentation (this folder)
├── hardhat.config.js         # Hardhat configuration
├── package.json
└── .env.example
```

