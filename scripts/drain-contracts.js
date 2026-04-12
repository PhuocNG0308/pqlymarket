/**
 * Drain funds from previously deployed contracts back to the deployer wallet.
 *
 * Reads deployment.json to find old contract addresses and uses the deployer
 * hexseed stored there (or from HEXSEED env var) to sign withdraw transactions.
 *
 * This is meant to be run before a fresh deployment to recover testnet QRL.
 *
 * Usage:
 *   node scripts/drain-contracts.js
 *
 * Environment:
 *   HEXSEED   - Override the hexseed from deployment.json (optional)
 *   RPC_URL   - QRL JSON-RPC endpoint (default: https://rpc.pqlymarket.com/)
 */

require("dotenv").config();
const { Web3 } = require("@theqrl/web3");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "https://rpc.pqlymarket.com/";

let CHAIN_ID = 1337;

function loadDeployment() {
  const deployPath = path.join(__dirname, "..", "deployment.json");
  if (!fs.existsSync(deployPath)) {
    console.log("No deployment.json found — nothing to drain.");
    return null;
  }
  return JSON.parse(fs.readFileSync(deployPath, "utf8"));
}

function loadArtifact(contractName) {
  const artifactPath = path.join(__dirname, "..", "artifacts", `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) return null;
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function sendMethod(web3, account, contractMethod, to, opts = {}) {
  const data = contractMethod.encodeABI();
  const gas = await contractMethod.estimateGas({ from: account.address, ...opts });
  const nonce = await web3.qrl.getTransactionCount(account.address, "latest");
  const block = await web3.qrl.getBlock("latest");
  const baseFee = BigInt(block.baseFeePerGas || 0);
  const maxPriorityFee = BigInt(web3.utils.toPlanck("1", "shor"));
  const maxFee = baseFee * 2n + maxPriorityFee;
  const txObj = {
    from: account.address,
    to,
    data,
    gas: Math.ceil(Number(gas) * 1.2).toString(),
    maxFeePerGas: maxFee.toString(),
    maxPriorityFeePerGas: maxPriorityFee.toString(),
    nonce: nonce.toString(),
    value: opts.value || "0",
    chainId: CHAIN_ID,
    type: "0x2",
  };
  const signed = await account.signTransaction(txObj);
  return web3.qrl.sendSignedTransaction(signed.rawTransaction);
}

async function main() {
  const deployment = loadDeployment();
  if (!deployment) return;

  console.log("Connecting to", RPC_URL);
  const web3 = new Web3(RPC_URL);

  CHAIN_ID = Number(await web3.qrl.getChainId());
  console.log("Detected chain ID:", CHAIN_ID);

  // Use hexseed from env, then from deployment.json
  const hexseed = process.env.HEXSEED || deployment.deployerHexseed;
  if (!hexseed) {
    console.log("No deployer hexseed found. Set HEXSEED env var or check deployment.json.");
    return;
  }

  const account = web3.qrl.accounts.seedToAccount(hexseed);
  web3.qrl.accounts.wallet.add(account);
  console.log("Deployer address:", account.address);

  const startBalance = await web3.qrl.getBalance(account.address);
  console.log("Deployer balance:", web3.utils.fromPlanck(startBalance, "quanta"), "QRL\n");

  let recovered = 0n;

  // ── Drain Faucet ──────────────────────────────────────────
  const faucetAddr = deployment.contracts?.Faucet;
  if (faucetAddr) {
    const faucetArtifact = loadArtifact("Faucet");
    if (faucetArtifact) {
      const faucetBal = await web3.qrl.getBalance(faucetAddr);
      console.log("Faucet balance:", web3.utils.fromPlanck(faucetBal, "quanta"), "QRL at", faucetAddr);

      if (BigInt(faucetBal) > 0n) {
        const faucet = new web3.qrl.Contract(faucetArtifact.abi, faucetAddr);

        // Try withdrawAll first (new contracts have it)
        try {
          console.log("  Calling withdrawAll()...");
          await sendMethod(web3, account, faucet.methods.withdrawAll(), faucetAddr);
          console.log("  ✓ Faucet drained via withdrawAll()");
          recovered += BigInt(faucetBal);
        } catch (e) {
          // Fallback: set claim amount to full balance, then claimFor deployer
          console.log("  withdrawAll() not available, trying setClaimAmount + claimFor...");
          try {
            await sendMethod(web3, account, faucet.methods.setClaimAmount(faucetBal.toString()), faucetAddr);
            await sendMethod(web3, account, faucet.methods.claimFor(account.address), faucetAddr);
            console.log("  ✓ Faucet drained via claimFor()");
            recovered += BigInt(faucetBal);
          } catch (e2) {
            console.log("  ✗ Could not drain Faucet:", e2.message);
          }
        }
      } else {
        console.log("  Faucet is empty, skipping.");
      }
    }
  }

  // ── Drain BondingCurve fees ───────────────────────────────
  const bcAddr = deployment.contracts?.BondingCurve;
  if (bcAddr) {
    const bcArtifact = loadArtifact("BondingCurve");
    if (bcArtifact) {
      const bcBal = await web3.qrl.getBalance(bcAddr);
      console.log("\nBondingCurve balance:", web3.utils.fromPlanck(bcBal, "quanta"), "QRL at", bcAddr);

      if (BigInt(bcBal) > 0n) {
        const bc = new web3.qrl.Contract(bcArtifact.abi, bcAddr);
        try {
          // Set treasury to deployer so withdrawFees sends to us
          await sendMethod(web3, account, bc.methods.setTreasury(account.address), bcAddr);
          await sendMethod(web3, account, bc.methods.withdrawFees(), bcAddr);
          const newBcBal = await web3.qrl.getBalance(bcAddr);
          const feesRecovered = BigInt(bcBal) - BigInt(newBcBal);
          console.log("  ✓ Withdrew", web3.utils.fromPlanck(feesRecovered.toString(), "quanta"), "QRL in fees");
          recovered += feesRecovered;
        } catch (e) {
          console.log("  ✗ Could not withdraw BondingCurve fees:", e.message);
          console.log("  Note: Reserve funds are locked in the curve until graduation.");
        }
      } else {
        console.log("  BondingCurve is empty, skipping.");
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────
  const endBalance = await web3.qrl.getBalance(account.address);
  console.log("\n══════════════════════════════════════════════");
  console.log("Drain complete.");
  console.log("Recovered (approx):", web3.utils.fromPlanck(recovered.toString(), "quanta"), "QRL");
  console.log("Deployer balance:  ", web3.utils.fromPlanck(endBalance, "quanta"), "QRL");
  console.log("══════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Drain failed:", err);
  process.exit(1);
});
