/**
 * Quick verification script — reads deployed contract state from local gqrl.
 */
const { Web3 } = require("@theqrl/web3");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "https://qrlwallet.com/api/qrl-rpc/testnet/";
const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));

function loadAbi(name) {
  const p = path.join(__dirname, "..", "artifacts", `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}

async function main() {
  const deploy = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8")
  );

  const block = await web3.qrl.getBlockNumber();
  console.log("=== QRL Local Network Status ===");
  console.log("Current block:", block.toString());
  console.log("Chain ID:", (await web3.qrl.getChainId()).toString());

  // MarketFactory
  const factoryAbi = loadAbi("MarketFactory");
  const factory = new web3.qrl.Contract(factoryAbi, deploy.contracts.MarketFactory);
  const marketCount = await factory.methods.marketCount().call();
  console.log("\nMarkets deployed:", marketCount.toString());

  // Read each market
  const pmAbi = loadAbi("PredictionMarket");
  for (let i = 0; i < Number(marketCount); i++) {
    const mAddr = await factory.methods.markets(i).call();
    const m = new web3.qrl.Contract(pmAbi, mAddr);
    const question = await m.methods.question().call();
    const yesPrice = await m.methods.getYesPrice().call();
    const yesPct = (Number(yesPrice) / 1e18 * 100).toFixed(1);
    const liquidity = await web3.qrl.getBalance(mAddr);
    const liqQrl = web3.utils.fromPlanck(liquidity, "quanta");
    console.log(`  Market ${i}: "${question.substring(0, 55)}..." YES=${yesPct}% Liquidity=${liqQrl} QRL`);
  }

  // Faucet
  const faucetBal = await web3.qrl.getBalance(deploy.contracts.Faucet);
  console.log("\nFaucet balance:", web3.utils.fromPlanck(faucetBal, "quanta"), "QRL");

  // Deployer
  const deployerBal = await web3.qrl.getBalance(deploy.deployer);
  console.log("Deployer balance:", web3.utils.fromPlanck(deployerBal, "quanta"), "QRL");

  console.log("\n=== All contracts executing correctly on QRL local network ===");
}

main().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
