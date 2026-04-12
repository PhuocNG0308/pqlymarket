/**
 * Deploy PQlyMarket contracts to the QRL network using @theqrl/web3.
 *
 * go-qrl (gqrl) v0.3.0 uses ML-DSA-87 signatures (not secp256k1), so standard
 * Hardhat/ethers deployment won't work. This script uses @theqrl/web3 v0.4.0 which
 * natively sends qrl_* RPC methods — matching gqrl v0.3.0 (no translation needed).
 *
 * Usage:
 *   node scripts/deploy-qrl.js
 *
 * Environment:
 *   HEXSEED   - QRL hexseed for the deployer account (48 bytes)
 *   RPC_URL   - QRL JSON-RPC endpoint (default: https://rpc.pqlymarket.com/)
 */

require("dotenv").config();
const { Web3 } = require("@theqrl/web3");
const fs = require("fs");
const path = require("path");

// ── Configuration ────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL || "https://rpc.pqlymarket.com/";
const DEPLOYER_HEXSEED = process.env.HEXSEED;

if (!DEPLOYER_HEXSEED) {
  console.error("ERROR: Please set HEXSEED in the environment before deploying.");
  process.exit(1);
}

// Address that should be allowed to create markets (Q-prefix for @theqrl/web3 v0.4.0)
const MARKET_CREATOR_ADDRESS = "Qc670e4e2d24dB18ee19710eb4eCe9Dd3794D5740";

// Faucet: 400 QRL per claim
const FAUCET_CLAIM_AMOUNT = Web3.utils.toPlanck("400", "quanta");
// Fund faucet with 40,000 QRL from deployer
const FAUCET_INITIAL_FUND = Web3.utils.toPlanck("40000", "quanta");

// ── Helpers ──────────────────────────────────────────────────

// Detected at runtime in main(), used by deploy/send helpers
let CHAIN_ID = 1337;

/**
 * Load a Hyperion-compiled contract artifact from artifacts/.
 */
function loadArtifact(contractName) {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    `${contractName}.json`
  );
  if (!fs.existsSync(artifactPath)) {
    console.error(`   Artifact not found: ${artifactPath}`);
    console.error(`   Run 'npm run compile' first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function deployContract(web3, account, artifact, args = [], value = "0") {
  const contract = new web3.qrl.Contract(artifact.abi);
  const deployTx = contract.deploy({
    data: artifact.bytecode,
    arguments: args,
  });
  const gas = await deployTx.estimateGas({ from: account.address, value });
  const data = deployTx.encodeABI();
  const nonce = await web3.qrl.getTransactionCount(account.address, "latest");
  const block = await web3.qrl.getBlock("latest");
  const baseFee = BigInt(block.baseFeePerGas || 0);
  const maxPriorityFee = BigInt(web3.utils.toPlanck("1", "shor"));
  const maxFee = baseFee * 2n + maxPriorityFee;
  const txObj = {
    from: account.address,
    data,
    gas: Math.ceil(Number(gas) * 1.2).toString(),
    maxFeePerGas: maxFee.toString(),
    maxPriorityFeePerGas: maxPriorityFee.toString(),
    nonce: nonce.toString(),
    value,
    chainId: CHAIN_ID,
    type: "0x2",
  };
  const signed = await account.signTransaction(txObj);
  const receipt = await web3.qrl.sendSignedTransaction(signed.rawTransaction);
  // Return a contract instance at the deployed address
  return new web3.qrl.Contract(artifact.abi, receipt.contractAddress);
}

/**
 * Sign and send a contract method call.
 * Avoids `qrl_sendTransaction` (which requires node-side account) by using
 * `qrl_sendRawTransaction` instead (client-side signing).
 */
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
  const receipt = await web3.qrl.sendSignedTransaction(signed.rawTransaction);
  return receipt;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("Connecting to", RPC_URL);
  // gqrl v0.3.0 uses qrl_* methods and Q-prefix addresses.
  // @theqrl/web3 v0.4.0 sends qrl_* natively — no translation needed.
  const web3 = new Web3(RPC_URL);

  // Detect chain ID from the connected node
  CHAIN_ID = Number(await web3.qrl.getChainId());
  console.log("Detected chain ID:", CHAIN_ID);

  // Derive account from hexseed
  const account = web3.qrl.accounts.seedToAccount(DEPLOYER_HEXSEED);
  web3.qrl.accounts.wallet.add(account);
  console.log("Deployer address:", account.address);

  const balance = await web3.qrl.getBalance(account.address);
  console.log("Deployer balance:", web3.utils.fromPlanck(balance, "quanta"), "QRL");

  if (BigInt(balance) === 0n) {
    console.error("ERROR: Deployer has no balance. Fund the address in genesis.");
    process.exit(1);
  }

  // 1. Deploy ConditionalToken
  console.log("\n1. Deploying ConditionalToken...");
  const ctArtifact = loadArtifact("ConditionalToken");
  const ct = await deployContract(web3, account, ctArtifact);
  const ctAddress = ct.options.address;
  console.log("   ConditionalToken:", ctAddress);

  // 2. Deploy Oracle (Legacy, kept for reference/fallback if needed)
  console.log("2. Deploying Oracle...");
  const oracleArtifact = loadArtifact("Oracle");
  const oracle = await deployContract(web3, account, oracleArtifact);
  const oracleAddress = oracle.options.address;
  console.log("   Oracle:", oracleAddress);

  // 3. Deploy PqlToken (initialSupply = 0)
  console.log("\n3. Deploying PqlToken...");
  const pqlArtifact = loadArtifact("PqlToken");
  const pql = await deployContract(web3, account, pqlArtifact, ["0"]);
  const pqlAddress = pql.options.address;
  console.log("   PqlToken:", pqlAddress);

  // 4. Deploy BondingCurve
  console.log("4. Deploying BondingCurve...");
  const bcArtifact = loadArtifact("BondingCurve");
  const bondingCurve = await deployContract(web3, account, bcArtifact, [pqlAddress, account.address]);
  const bcAddress = bondingCurve.options.address;
  console.log("   BondingCurve:", bcAddress);

  // 5. Authorize BondingCurve as PqlToken minter
  console.log("5. Authorizing BondingCurve as PQL minter...");
  const pqlContract = new web3.qrl.Contract(pqlArtifact.abi, pqlAddress);
  await sendMethod(web3, account, pqlContract.methods.setMinter(bcAddress, true), pqlAddress);
  console.log("   BondingCurve authorized to mint PQL.");

  // 6. Deploy LiquidityPool
  console.log("6. Deploying LiquidityPool...");
  const lpArtifact = loadArtifact("LiquidityPool");
  const lp = await deployContract(web3, account, lpArtifact, [pqlAddress]);
  const lpAddress = lp.options.address;
  console.log("   LiquidityPool:", lpAddress);

  // 7. Deploy GovernanceOracle
  console.log("7. Deploying GovernanceOracle...");
  const govArtifact = loadArtifact("GovernanceOracle");
  const gov = await deployContract(web3, account, govArtifact, [pqlAddress]);
  const govAddress = gov.options.address;
  console.log("   GovernanceOracle:", govAddress);

  // 8. Deploy MarketFactory
  console.log("\n8. Deploying MarketFactory...");
  const factoryArtifact = loadArtifact("MarketFactory");
  const factory = await deployContract(web3, account, factoryArtifact, [
    ctAddress,
    govAddress, // FIXED! Replaced legacy oracleAddress with govAddress
  ]);
  const factoryAddress = factory.options.address;
  console.log("   MarketFactory:", factoryAddress);

  // 9. Transfer ConditionalToken ownership to MarketFactory
  console.log("9. Transferring CT ownership to MarketFactory...");
  const ctContract = new web3.qrl.Contract(ctArtifact.abi, ctAddress);
  await sendMethod(web3, account, ctContract.methods.transferOwnership(factoryAddress), ctAddress);
  console.log("   Ownership transferred.");

  // 10. Grant market creation permission
  console.log("10. Granting market creation to", MARKET_CREATOR_ADDRESS, "...");
  const factoryContract = new web3.qrl.Contract(
    factoryArtifact.abi,
    factoryAddress
  );
  await sendMethod(web3, account, factoryContract.methods.setMarketCreator(MARKET_CREATOR_ADDRESS, true), factoryAddress);
  // Also grant deployer as creator
  await sendMethod(web3, account, factoryContract.methods.setMarketCreator(account.address, true), factoryAddress);
  console.log("   Market creator permissions granted.");

  // 11. Deploy Faucet
  console.log("\n11. Deploying Faucet (claim:", web3.utils.fromPlanck(FAUCET_CLAIM_AMOUNT, "quanta"), "QRL)...");
  const faucetArtifact = loadArtifact("Faucet");
  const faucet = await deployContract(
    web3,
    account,
    faucetArtifact,
    [FAUCET_CLAIM_AMOUNT],
    FAUCET_INITIAL_FUND
  );
  const faucetAddress = faucet.options.address;
  console.log("   Faucet:", faucetAddress);
  const faucetBal = await web3.qrl.getBalance(faucetAddress);
  console.log("   Faucet balance:", web3.utils.fromPlanck(faucetBal, "quanta"), "QRL");

  // ── Summary ────────────────────────────────────────────────
  const finalBal = await web3.qrl.getBalance(account.address);
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║         Deployment Complete                  ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║ ConditionalToken:", ctAddress);
  console.log("║ Oracle:          ", oracleAddress);
  console.log("║ MarketFactory:   ", factoryAddress);
  console.log("║ Faucet:          ", faucetAddress);
  console.log("║ PqlToken:        ", pqlAddress);
  console.log("║ BondingCurve:    ", bcAddress);
  console.log("║ LiquidityPool:   ", lpAddress);
  console.log("║ GovernanceOracle:", govAddress);
  console.log("║ Owner/Admin:     ", account.address);
  console.log("║ Market Creator:  ", MARKET_CREATOR_ADDRESS);
  console.log("║ Deployer balance:", web3.utils.fromPlanck(finalBal, "quanta"), "QRL");
  console.log("╚══════════════════════════════════════════════╝");

  // Save deployment info
  const deployment = {
    network: "qrl-testnet",
    chainId: CHAIN_ID,
    contracts: {
      ConditionalToken: ctAddress,
      Oracle: oracleAddress,
      MarketFactory: factoryAddress,
      Faucet: faucetAddress,
      PqlToken: pqlAddress,
      BondingCurve: bcAddress,
      LiquidityPool: lpAddress,
      GovernanceOracle: govAddress,
    },
    deployer: account.address,
    marketCreator: MARKET_CREATOR_ADDRESS,
    faucetClaimAmount: web3.utils.fromPlanck(FAUCET_CLAIM_AMOUNT, "quanta") + " QRL",
    timestamp: new Date().toISOString(),
  };

  const deployPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(deployPath, JSON.stringify(deployment, null, 2));
  console.log("\nDeployment info saved to deployment.json");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
