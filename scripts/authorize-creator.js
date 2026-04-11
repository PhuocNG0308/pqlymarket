/**
 * Authorize a wallet address as a market creator on the MarketFactory contract.
 *
 * Usage:
 *   node scripts/authorize-creator.js <Q-prefixed-address>
 *   node scripts/authorize-creator.js Qc670e4e2d24dB18ee19710eb4eCe9Dd3794D5740
 *
 * Environment:
 *   HEXSEED   - QRL hexseed for the deployer/owner account
 *   RPC_URL   - QRL JSON-RPC endpoint (default: https://qrlwallet.com/api/qrl-rpc/testnet)
 */

const { Web3 } = require("@theqrl/web3");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "https://qrlwallet.com/api/qrl-rpc/testnet";
const DEPLOYER_HEXSEED = process.env.HEXSEED;

if (!DEPLOYER_HEXSEED) {
  console.error("ERROR: Please set HEXSEED in the environment before deploying.");
  process.exit(1);
}

function loadDeployment() {
  const deployPath = path.join(__dirname, "..", "deployment.json");
  return JSON.parse(fs.readFileSync(deployPath, "utf8"));
}

function loadArtifact(name) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "artifacts", `${name}.json`), "utf8")
  );
}

async function main() {
  const targetAddress = process.argv[2];
  if (!targetAddress) {
    console.error("Usage: node scripts/authorize-creator.js <Q-address>");
    console.error("Example: node scripts/authorize-creator.js Q1234567890abcdef1234567890abcdef12345678");
    process.exit(1);
  }

  // Normalize: accept 0x-prefix too
  let qAddress = targetAddress;
  if (qAddress.startsWith("0x") && qAddress.length === 42) {
    qAddress = "Q" + qAddress.slice(2);
  }
  if (!qAddress.match(/^Q[0-9a-fA-F]{40}$/)) {
    console.error("Invalid address format. Expected Q + 40 hex chars.");
    process.exit(1);
  }

  const deployment = loadDeployment();
  const factoryAddress = deployment.contracts.MarketFactory;
  const artifact = loadArtifact("MarketFactory");

  console.log("Connecting to", RPC_URL);
  const web3 = new Web3(RPC_URL);

  const account = web3.qrl.accounts.seedToAccount(DEPLOYER_HEXSEED);
  web3.qrl.accounts.wallet.add(account);
  console.log("Deployer:", account.address);

  const factory = new web3.qrl.Contract(artifact.abi, factoryAddress);

  // Check current status
  const alreadyCreator = await factory.methods.isMarketCreator(qAddress).call();
  if (alreadyCreator) {
    console.log(`${qAddress} is already an authorized market creator.`);
    process.exit(0);
  }

  // Send setMarketCreator transaction
  console.log(`Authorizing ${qAddress} as market creator...`);
  const method = factory.methods.setMarketCreator(qAddress, true);
  const gas = await method.estimateGas({ from: account.address });
  const nonce = await web3.qrl.getTransactionCount(account.address, "latest");
  const block = await web3.qrl.getBlock("latest");
  const baseFee = BigInt(block.baseFeePerGas || 0);
  const maxPriorityFee = BigInt(web3.utils.toPlanck("1", "shor"));
  const maxFee = baseFee * 2n + maxPriorityFee;

  const txObj = {
    from: account.address,
    to: factoryAddress,
    data: method.encodeABI(),
    gas: Math.ceil(Number(gas) * 1.2).toString(),
    maxFeePerGas: maxFee.toString(),
    maxPriorityFeePerGas: maxPriorityFee.toString(),
    nonce: nonce.toString(),
    value: "0",
    chainId: deployment.chainId,
    type: "0x2",
  };

  const signed = await account.signTransaction(txObj);
  const receipt = await web3.qrl.sendSignedTransaction(signed.rawTransaction);
  console.log("Transaction hash:", receipt.transactionHash);
  console.log("Status:", receipt.status ? "SUCCESS" : "FAILED");

  // Verify
  const isNow = await factory.methods.isMarketCreator(qAddress).call();
  console.log(`isMarketCreator(${qAddress}):`, isNow);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err.message || err);
  process.exit(1);
});
