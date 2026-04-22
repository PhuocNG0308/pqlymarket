import fs from "fs";
import path from "path";
import { ContractAddresses } from "../types";

// Convert Q-prefix addresses from deployment.json to 0x-prefix for ethers.js
function normalizeAddress(addr: string | undefined): string | undefined {
  if (!addr) return addr;
  if (addr.startsWith("Q")) return "0x" + addr.slice(1);
  if (addr.startsWith("Z")) return "0x" + addr.slice(1);
  return addr;
}

// Load contract addresses from deployment.json (written by deploy scripts)
function loadDeployment(): ContractAddresses {
  const deployPath = path.join(__dirname, "..", "..", "..", "deployment.json");
  try {
    const raw = fs.readFileSync(deployPath, "utf8");
    const data = JSON.parse(raw);
    if (data.contracts) {
      console.log(`[Contracts] Loaded from deployment.json (${data.network || "unknown"} @ ${data.timestamp || "?"})`);
      return {
        ConditionalToken: normalizeAddress(data.contracts.ConditionalToken)!,
        Oracle: normalizeAddress(data.contracts.Oracle)!,
        PqlToken: normalizeAddress(data.contracts.PqlToken),
        GovernanceOracle: normalizeAddress(data.contracts.GovernanceOracle),
        MarketFactory: normalizeAddress(data.contracts.MarketFactory)!,
        Faucet: normalizeAddress(data.contracts.Faucet),
        BondingCurve: normalizeAddress(data.contracts.BondingCurve),
        LiquidityPool: normalizeAddress(data.contracts.LiquidityPool),
      };
    }
  } catch {
    console.warn("[Contracts] deployment.json not found, using env/defaults");
  }

  return {
    ConditionalToken:
      process.env.CONDITIONAL_TOKEN ||
      "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    Oracle:
      process.env.ORACLE || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    PqlToken: process.env.PQL_TOKEN,
    GovernanceOracle: process.env.GOVERNANCE_ORACLE,
    MarketFactory:
      process.env.MARKET_FACTORY ||
      "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    Faucet: process.env.FAUCET || "0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB",
  };
}

export const CONTRACTS: ContractAddresses = loadDeployment();

export const CHAIN_ID = parseInt(process.env.CHAIN_ID || "1337", 10);
export const RPC_URL = process.env.RPC_URL || "https://qrlwallet.com/api/qrl-rpc/testnet/";
