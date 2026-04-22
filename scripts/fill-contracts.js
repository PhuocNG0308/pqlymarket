/**
 * Fill deployed contracts with QRL from the deployer wallet.
 *
 * This is the opposite of drain-contracts.js. It reads deployment.json
 * and sends QRL to contracts that need initial funding (primarily the Faucet).
 *
 * Default behavior:
 *   - Faucet:       40,000 QRL (so users can claim testnet QRL)
 *   - BondingCurve: 0 QRL (funded by users buying PQL)
 *   - LiquidityPool: 0 QRL (funded by liquidity providers)
 *
 * Override amounts with environment variables:
 *   FAUCET_AMOUNT=50000   - Send 50,000 QRL to Faucet instead of 40,000
 *   BC_AMOUNT=1000        - Also send 1,000 QRL to BondingCurve
 *   LP_AMOUNT=1000        - Also send 1,000 QRL to LiquidityPool
 *
 * Usage:
 *   node scripts/fill-contracts.js
 *   FAUCET_AMOUNT=50000 node scripts/fill-contracts.js
 *
 * Environment:
 *   HEXSEED   - Override the hexseed from deployment.json (optional)
 *   RPC_URL   - QRL JSON-RPC endpoint (default: https://qrlwallet.com/api/qrl-rpc/testnet/)
 */

require("dotenv").config();
const { Web3 } = require("@theqrl/web3");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "https://qrlwallet.com/api/qrl-rpc/testnet/";

let CHAIN_ID = 1337;

function loadDeployment() {
  const deployPath = path.join(__dirname, "..", "deployment.json");
  if (!fs.existsSync(deployPath)) {
    console.error("No deployment.json found. Run 'npm run deploy' first.");
    return null;
  }
  return JSON.parse(fs.readFileSync(deployPath, "utf8"));
}

async function sendQRL(web3, account, toAddress, amountInQuanta, label) {
  const amountPlanck = web3.utils.toPlanck(amountInQuanta.toString(), "quanta");

  const currentBal = await web3.qrl.getBalance(toAddress);
  const currentBalQRL = web3.utils.fromPlanck(currentBal, "quanta");
  console.log(`\n${label}`);
  console.log(`  Address: ${toAddress}`);
  console.log(`  Current balance: ${currentBalQRL} QRL`);
  console.log(`  Sending: ${amountInQuanta} QRL`);

  if (BigInt(amountPlanck) === 0n) {
    console.log("  Skipping (amount is 0).");
    return 0n;
  }

  const nonce = await web3.qrl.getTransactionCount(account.address, "latest");
  const block = await web3.qrl.getBlock("latest");
  const baseFee = BigInt(block.baseFeePerGas || 0);
  const maxPriorityFee = BigInt(web3.utils.toPlanck("1", "shor"));
  const maxFee = baseFee * 2n + maxPriorityFee;

  let estimatedGas = "500000";
  try {
    estimatedGas = await web3.qrl.estimateGas({
      from: account.address,
      to: toAddress,
      value: amountPlanck
    });
    // Add 20% margin
    estimatedGas = (BigInt(estimatedGas) * 120n / 100n).toString();
  } catch (err) {
    console.log(`  Gas estimation failed, using default: ${estimatedGas}`);
  }

  const txObj = {
    from: account.address,
    to: toAddress,
    gas: estimatedGas,
    maxFeePerGas: maxFee.toString(),
    maxPriorityFeePerGas: maxPriorityFee.toString(),
    nonce: nonce.toString(),
    value: amountPlanck,
    chainId: CHAIN_ID,
    type: "0x2",
  };

  const signed = await account.signTransaction(txObj);
  const receipt = await web3.qrl.sendSignedTransaction(signed.rawTransaction);

  if (receipt.status) {
    const newBal = await web3.qrl.getBalance(toAddress);
    console.log(`  ✓ Sent! New balance: ${web3.utils.fromPlanck(newBal, "quanta")} QRL`);
    console.log(`  Tx: ${receipt.transactionHash}`);
    return BigInt(amountPlanck);
  } else {
    console.log(`  ✗ Transaction failed!`);
    return 0n;
  }
}

async function main() {
  const deployment = loadDeployment();
  if (!deployment) return;

  console.log("═══════════════════════════════════════════════");
  console.log("  PQlyMarket — Fill Contracts with QRL");
  console.log("═══════════════════════════════════════════════");
  console.log("Connecting to", RPC_URL);

  const web3 = new Web3(RPC_URL);

  CHAIN_ID = Number(await web3.qrl.getChainId());
  console.log("Chain ID:", CHAIN_ID);

  // Use hexseed from env, then from deployment.json
  const hexseed = process.env.HEXSEED || deployment.deployerHexseed;
  if (!hexseed) {
    console.error("No deployer hexseed found. Set HEXSEED env var or check deployment.json.");
    return;
  }

  const account = web3.qrl.accounts.seedToAccount(hexseed);
  web3.qrl.accounts.wallet.add(account);
  console.log("Deployer address:", account.address);

  const startBalance = await web3.qrl.getBalance(account.address);
  const startBalQRL = web3.utils.fromPlanck(startBalance, "quanta");
  console.log("Deployer balance:", startBalQRL, "QRL");

  // Parse amounts from env or use defaults
  const faucetAmount = parseInt(process.env.FAUCET_AMOUNT || "40000", 10);
  const bcAmount = parseInt(process.env.BC_AMOUNT || "0", 10);
  const lpAmount = parseInt(process.env.LP_AMOUNT || "0", 10);

  const totalRequired = faucetAmount + bcAmount + lpAmount;
  const deployerQRL = parseFloat(startBalQRL);

  if (deployerQRL < totalRequired) {
    console.error(`\n✗ Insufficient balance! Need ${totalRequired} QRL, have ${startBalQRL} QRL.`);
    console.error("  Reduce amounts or fund the deployer address first.");
    process.exit(1);
  }

  let totalSent = 0n;

  // ── Fill Faucet ──────────────────────────────────────────
  const faucetAddr = deployment.contracts?.Faucet;
  if (faucetAddr && faucetAmount > 0) {
    totalSent += await sendQRL(web3, account, faucetAddr, faucetAmount, "Faucet");
  }

  // ── Fill BondingCurve (optional) ──────────────────────────
  const bcAddr = deployment.contracts?.BondingCurve;
  if (bcAddr && bcAmount > 0) {
    totalSent += await sendQRL(web3, account, bcAddr, bcAmount, "BondingCurve");
  }

  // ── Fill LiquidityPool (optional) ─────────────────────────
  const lpAddr = deployment.contracts?.LiquidityPool;
  if (lpAddr && lpAmount > 0) {
    totalSent += await sendQRL(web3, account, lpAddr, lpAmount, "LiquidityPool");
  }

  // ── Summary ───────────────────────────────────────────────
  const endBalance = await web3.qrl.getBalance(account.address);
  console.log("\n═══════════════════════════════════════════════");
  console.log("Fill complete.");
  console.log("Total sent:", web3.utils.fromPlanck(totalSent.toString(), "quanta"), "QRL");
  console.log("Deployer balance:", web3.utils.fromPlanck(endBalance, "quanta"), "QRL");
  console.log("═══════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fill failed:", err);
  process.exit(1);
});
