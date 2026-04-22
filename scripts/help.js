#!/usr/bin/env node
/**
 * Display all available npm commands and their descriptions.
 * Usage: npm run help
 */

const COMMANDS = [
  {
    group: "Smart Contracts",
    commands: [
      {
        name: "npm run compile",
        script: "node scripts/hyp-compile.js",
        desc: "Compile tất cả Hyperion smart contracts (.hyp) → artifacts/ (ABI + bytecode)",
      },
      {
        name: "npm run deploy",
        script: "node scripts/deploy-qrl.js",
        desc: "Deploy toàn bộ contracts lên QRL Zond Testnet. Yêu cầu HEXSEED env var.\n" +
              "              Deploy: ConditionalToken, Oracle, PqlToken, BondingCurve, LiquidityPool,\n" +
              "              GovernanceOracle, MarketFactory, Faucet. Tự động fund Faucet 40,000 QRL.\n" +
              "              Kết quả lưu vào deployment.json",
      },
      {
        name: "npm run drain",
        script: "node scripts/drain-contracts.js",
        desc: "Hút toàn bộ QRL từ các contracts đã deploy về ví deployer.\n" +
              "              Drain Faucet (withdrawAll), drain BondingCurve fees.\n" +
              "              Dùng trước khi re-deploy để thu hồi testnet QRL.",
      },
      {
        name: "npm run fill",
        script: "node scripts/fill-contracts.js",
        desc: "Nạp QRL từ ví deployer vào các contracts (ngược lại với drain).\n" +
              "              Mặc định: Faucet = 40,000 QRL. Tuỳ chỉnh:\n" +
              "              FAUCET_AMOUNT=50000 npm run fill\n" +
              "              BC_AMOUNT=1000 LP_AMOUNT=500 npm run fill",
      },
      {
        name: "npm run verify",
        script: "node scripts/verify-deploy.js",
        desc: "Kiểm tra trạng thái contracts đã deploy: market count, faucet balance,\n" +
              "              deployer balance, chain ID, block number.",
      },
      {
        name: "npm run authorize",
        script: "node scripts/authorize-creator.js <Q-address>",
        desc: "Cấp quyền tạo market cho một địa chỉ ví trên MarketFactory.\n" +
              "              Ví dụ: npm run authorize -- Qc670e4e2d24dB18ee19710eb4eCe9Dd3794D5740",
      },
    ],
  },
  {
    group: "Build",
    commands: [
      {
        name: "npm run build",
        script: "npm run build:contracts && npm run build:frontend",
        desc: "Build toàn bộ: compile contracts + build frontend (TypeScript + Tailwind CSS)",
      },
      {
        name: "npm run build:contracts",
        script: "node scripts/hyp-compile.js",
        desc: "Chỉ compile contracts (alias của npm run compile)",
      },
      {
        name: "npm run build:frontend",
        script: "cd frontend && npm install && npm run build",
        desc: "Build frontend: install deps, compile TypeScript, minify Tailwind CSS",
      },
    ],
  },
  {
    group: "Development",
    commands: [
      {
        name: "npm run dev",
        script: "compile → drain → deploy → frontend:dev",
        desc: "Full dev cycle: compile contracts, drain cũ, deploy mới, khởi chạy frontend\n" +
              "              với hot reload (tsx watch + tailwind watch). DEV mode trên localhost:3000",
      },
      {
        name: "npm run frontend:dev",
        script: "cd frontend && npm install && npm run dev",
        desc: "Chỉ chạy frontend dev server (tsx watch + tailwind watch) ở localhost:3000",
      },
    ],
  },
  {
    group: "Frontend",
    commands: [
      {
        name: "npm run public  (trong frontend/)",
        script: "./start-public.sh",
        desc: "Khởi chạy frontend + RPC proxy + Cloudflare tunnel.\n" +
              "              Truy cập qua https://pqlymarket.com (public)",
      },
    ],
  },
  {
    group: "Utilities",
    commands: [
      {
        name: "npm run patch-web3",
        script: "node scripts/patch-web3.js",
        desc: "Patch @theqrl/web3-zond-accounts thêm Descriptor + ExtraParams fields\n" +
              "              cho go-qrl v0.3.0 DynamicFeeTx format (chạy sau npm install)",
      },
      {
        name: "npm run help",
        script: "node scripts/help.js",
        desc: "Hiển thị danh sách tất cả commands và mô tả (bạn đang xem cái này)",
      },
    ],
  },
];

// Color codes
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const WHITE = "\x1b[37m";

console.log();
console.log(`${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${RESET}`);
console.log(`${BOLD}${CYAN}║              PQlyMarket — Available Commands                ║${RESET}`);
console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${RESET}`);

for (const group of COMMANDS) {
  console.log();
  console.log(`${BOLD}${YELLOW}  ── ${group.group} ${"─".repeat(Math.max(0, 52 - group.group.length))}${RESET}`);
  console.log();

  for (const cmd of group.commands) {
    console.log(`  ${GREEN}${cmd.name}${RESET}`);
    console.log(`  ${DIM}→ ${cmd.script}${RESET}`);
    console.log(`  ${WHITE}${cmd.desc}${RESET}`);
    console.log();
  }
}

console.log(`${DIM}  Environment variables:${RESET}`);
console.log(`  ${DIM}HEXSEED${RESET}        QRL hexseed cho deployer account (bắt buộc cho deploy/drain/fill)`);
console.log(`  ${DIM}RPC_URL${RESET}        QRL JSON-RPC endpoint (mặc định: https://qrlwallet.com/api/qrl-rpc/testnet/)`);
console.log(`  ${DIM}FAUCET_AMOUNT${RESET}  Số QRL nạp vào Faucet khi chạy fill (mặc định: 40000)`);
console.log(`  ${DIM}BC_AMOUNT${RESET}      Số QRL nạp vào BondingCurve khi chạy fill (mặc định: 0)`);
console.log(`  ${DIM}LP_AMOUNT${RESET}      Số QRL nạp vào LiquidityPool khi chạy fill (mặc định: 0)`);
console.log();
