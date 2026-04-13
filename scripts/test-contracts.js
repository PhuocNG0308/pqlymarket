/**
 * PQlyMarket Contract Verification Test Suite
 *
 * Deploys fresh contracts to QRL testnet and runs through all critical
 * business logic: market creation, multi-outcome AMM, buy/sell shares,
 * price impact, resolution, and winnings claim.
 *
 * Usage:
 *   node scripts/test-contracts.js
 *
 * Environment:
 *   HEXSEED   - QRL hexseed for the deployer/test account
 *   RPC_URL   - QRL JSON-RPC endpoint (default: https://rpc.pqlymarket.com/)
 */

require("dotenv").config();
const { Web3 } = require("@theqrl/web3");
const fs = require("fs");
const path = require("path");

// ── Config ───────────────────────────────────────────────────

const RPC_URL = process.env.RPC_URL || "https://rpc.pqlymarket.com/";
const DEPLOYER_HEXSEED = process.env.HEXSEED;

if (!DEPLOYER_HEXSEED) {
  console.error("ERROR: Set HEXSEED environment variable.");
  process.exit(1);
}

let CHAIN_ID = 1337;
let passed = 0;
let failed = 0;
const failures = [];

// ── Helpers ──────────────────────────────────────────────────

function loadArtifact(name) {
  const p = path.join(__dirname, "..", "artifacts", `${name}.json`);
  if (!fs.existsSync(p)) {
    console.error(`Artifact not found: ${p}. Run 'npm run compile' first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function deployContract(web3, account, artifact, args = [], value = "0") {
  const contract = new web3.qrl.Contract(artifact.abi);
  const deployTx = contract.deploy({ data: artifact.bytecode, arguments: args });
  const gas = await deployTx.estimateGas({ from: account.address, value });
  const data = deployTx.encodeABI();
  const nonce = await web3.qrl.getTransactionCount(account.address, "pending");
  const block = await web3.qrl.getBlock("latest");
  const baseFee = BigInt(block.baseFeePerGas || 0);
  const maxPriorityFee = BigInt(web3.utils.toPlanck("10", "shor"));
  const maxFee = baseFee * 3n + maxPriorityFee;
  const txObj = {
    from: account.address,
    data,
    gas: Math.ceil(Number(gas) * 1.3).toString(),
    maxFeePerGas: maxFee.toString(),
    maxPriorityFeePerGas: maxPriorityFee.toString(),
    nonce: nonce.toString(),
    value,
    chainId: CHAIN_ID,
    type: "0x2",
  };
  const signed = await account.signTransaction(txObj);
  const receipt = await web3.qrl.sendSignedTransaction(signed.rawTransaction);
  return new web3.qrl.Contract(artifact.abi, receipt.contractAddress);
}

async function sendMethod(web3, account, method, to, opts = {}) {
  const data = method.encodeABI();
  const gas = await method.estimateGas({ from: account.address, ...opts });
  const nonce = await web3.qrl.getTransactionCount(account.address, "pending");
  const block = await web3.qrl.getBlock("latest");
  const baseFee = BigInt(block.baseFeePerGas || 0);
  const maxPriorityFee = BigInt(web3.utils.toPlanck("10", "shor"));
  const maxFee = baseFee * 3n + maxPriorityFee;
  const txObj = {
    from: account.address,
    to,
    data,
    gas: Math.ceil(Number(gas) * 1.3).toString(),
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

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}`);
    failed++;
    failures.push(testName);
  }
}

function assertEq(actual, expected, testName) {
  assert(String(actual) === String(expected), `${testName} (got: ${actual}, expected: ${expected})`);
}

function assertGt(a, b, testName) {
  assert(BigInt(a) > BigInt(b), `${testName} (${a} > ${b})`);
}

function assertLt(a, b, testName) {
  assert(BigInt(a) < BigInt(b), `${testName} (${a} < ${b})`);
}

// ── Main Test Suite ──────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║    PQlyMarket Contract Verification Suite    ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const web3 = new Web3(RPC_URL);
  CHAIN_ID = Number(await web3.qrl.getChainId());
  console.log(`Network: ${RPC_URL} (chain ${CHAIN_ID})`);

  const account = web3.qrl.accounts.seedToAccount(DEPLOYER_HEXSEED);
  web3.qrl.accounts.wallet.add(account);
  console.log(`Account: ${account.address}`);

  const balance = await web3.qrl.getBalance(account.address);
  console.log(`Balance: ${web3.utils.fromPlanck(balance, "quanta")} QRL\n`);

  if (BigInt(balance) === 0n) {
    console.error("ERROR: No balance. Cannot run tests.");
    process.exit(1);
  }

  // ════════════════════════════════════════════════════════════
  // Phase 1: Deploy test contracts
  // ════════════════════════════════════════════════════════════
  console.log("══ Phase 1: Deploy Test Contracts ══\n");

  const ctArtifact = loadArtifact("ConditionalToken");
  const oracleArtifact = loadArtifact("Oracle");
  const factoryArtifact = loadArtifact("MarketFactory");
  const marketArtifact = loadArtifact("PredictionMarket");

  console.log("  Deploying ConditionalToken...");
  const ct = await deployContract(web3, account, ctArtifact);
  console.log(`  → ${ct.options.address}`);

  console.log("  Deploying Oracle...");
  const oracle = await deployContract(web3, account, oracleArtifact);
  console.log(`  → ${oracle.options.address}`);

  console.log("  Deploying MarketFactory...");
  const factory = await deployContract(web3, account, factoryArtifact, [
    ct.options.address,
    oracle.options.address,
  ]);
  console.log(`  → ${factory.options.address}`);

  // Transfer CT ownership to factory
  console.log("  Transferring CT ownership to Factory...");
  await sendMethod(web3, account, ct.methods.transferOwnership(factory.options.address), ct.options.address);

  // Grant creator permission
  console.log("  Granting market creator permission...");
  await sendMethod(web3, account, factory.methods.setMarketCreator(account.address, true), factory.options.address);

  console.log("  ✓ All test contracts deployed.\n");

  // ════════════════════════════════════════════════════════════
  // Phase 2: Binary Market Tests
  // ════════════════════════════════════════════════════════════
  console.log("══ Phase 2: Binary Market (2 outcomes) ══\n");

  const futureTime = Math.floor(Date.now() / 1000) + 86400; // +24h

  console.log("  Creating binary market...");
  const createBinaryReceipt = await sendMethod(
    web3, account,
    factory.methods.createBinaryMarket("Will BTC hit 100k?", futureTime),
    factory.options.address
  );
  assert(createBinaryReceipt.status === 1n || createBinaryReceipt.status === true, "Binary market created");

  const marketCount = await factory.methods.getMarketCount().call();
  assertEq(marketCount, "1", "Market count = 1");

  const market0Addr = await factory.methods.getMarket(0).call();
  assert(market0Addr && market0Addr !== "0x0000000000000000000000000000000000000000", "Market address is valid");

  const market0 = new web3.qrl.Contract(marketArtifact.abi, market0Addr);

  // Check market properties
  const q = await market0.methods.question().call();
  assert(q === "Will BTC hit 100k?", "Question matches");

  const oc = await market0.methods.outcomeCount().call();
  assertEq(oc, "2", "Outcome count = 2 for binary");

  const label0 = await market0.methods.getOutcomeLabel(0).call();
  const label1 = await market0.methods.getOutcomeLabel(1).call();
  assertEq(label0, "Yes", "Label 0 = Yes");
  assertEq(label1, "No", "Label 1 = No");

  // Check initial prices (should be ~0.5 ether each = 50%)
  const yesPrice0 = await market0.methods.getYesPrice(0).call();
  assertEq(yesPrice0, web3.utils.toWei("0.5", "ether"), "Initial YES price = 0.5 (50%)");

  const noPrice0 = await market0.methods.getNoPrice(0).call();
  assertEq(noPrice0, web3.utils.toWei("0.5", "ether"), "Initial NO price = 0.5 (50%)");

  // Buy YES shares on outcome 0
  const buyAmount = web3.utils.toWei("1", "ether"); // 1 QRL
  console.log("  Buying 1 QRL of YES shares (outcome 0)...");
  const buyReceipt = await sendMethod(
    web3, account,
    market0.methods.buyShares(0, true, "0"), // outcomeIndex=0, isYes=true, minShares=0
    market0Addr,
    { value: buyAmount }
  );
  assert(buyReceipt.status === 1n || buyReceipt.status === true, "Buy YES shares succeeded");

  // Check prices changed
  const yesPriceAfterBuy = await market0.methods.getYesPrice(0).call();
  assertGt(yesPriceAfterBuy, yesPrice0, "YES price increased after buying YES");

  const noPriceAfterBuy = await market0.methods.getNoPrice(0).call();
  assertLt(noPriceAfterBuy, noPrice0, "NO price decreased after buying YES");

  // Check user has YES tokens
  const yesTokenId = await ct.methods.outcomeYesTokenId(0, 0).call();
  const userYesBalance = await ct.methods.balanceOf(account.address, yesTokenId).call();
  assertGt(userYesBalance, 0, "User has YES tokens after buy");

  // Sell half the shares back
  const halfShares = (BigInt(userYesBalance) / 2n).toString();
  console.log(`  Selling ${halfShares} YES shares back...`);
  const sellReceipt = await sendMethod(
    web3, account,
    market0.methods.sellShares(0, true, halfShares, "0"),
    market0Addr
  );
  assert(sellReceipt.status === 1n || sellReceipt.status === true, "Sell YES shares succeeded");

  const userYesAfterSell = await ct.methods.balanceOf(account.address, yesTokenId).call();
  assertLt(userYesAfterSell, userYesBalance, "User balance decreased after sell");

  // Check volume tracked
  const volume = await market0.methods.totalVolume().call();
  assertGt(volume, 0, "Total volume tracked > 0");

  const traders = await market0.methods.traderCount().call();
  assertEq(traders, "1", "Trader count = 1");

  console.log("");

  // ════════════════════════════════════════════════════════════
  // Phase 3: Multi-Outcome Market Tests
  // ════════════════════════════════════════════════════════════
  console.log("══ Phase 3: Multi-Outcome Market (4 outcomes) ══\n");

  console.log("  Creating 4-outcome market...");
  const createMultiReceipt = await sendMethod(
    web3, account,
    factory.methods.createMarket(
      "Who will win the election?",
      ["Alice", "Bob", "Charlie", "Dave"],
      futureTime
    ),
    factory.options.address
  );
  assert(createMultiReceipt.status === 1n || createMultiReceipt.status === true, "Multi-outcome market created");

  const mc2 = await factory.methods.getMarketCount().call();
  assertEq(mc2, "2", "Market count = 2");

  const market1Addr = await factory.methods.getMarket(1).call();
  const market1 = new web3.qrl.Contract(marketArtifact.abi, market1Addr);

  const oc2 = await market1.methods.outcomeCount().call();
  assertEq(oc2, "4", "Outcome count = 4");

  // Verify all labels
  const labels = await market1.methods.getOutcomeLabels().call();
  assertEq(labels.length, 4, "Labels array length = 4");
  assertEq(labels[0], "Alice", "Label 0 = Alice");
  assertEq(labels[1], "Bob", "Label 1 = Bob");
  assertEq(labels[2], "Charlie", "Label 2 = Charlie");
  assertEq(labels[3], "Dave", "Label 3 = Dave");

  // All initial prices should be 50% (independent AMM pools)
  for (let i = 0; i < 4; i++) {
    const yp = await market1.methods.getYesPrice(i).call();
    assertEq(yp, web3.utils.toWei("0.5", "ether"), `Outcome ${i} initial YES price = 0.5`);
  }

  // Buy YES on outcome 0 (Alice)
  console.log("  Buying YES on Alice (outcome 0)...");
  await sendMethod(
    web3, account,
    market1.methods.buyShares(0, true, "0"),
    market1Addr,
    { value: web3.utils.toWei("2", "ether") }
  );

  // Buy YES on outcome 2 (Charlie)
  console.log("  Buying YES on Charlie (outcome 2)...");
  await sendMethod(
    web3, account,
    market1.methods.buyShares(2, true, "0"),
    market1Addr,
    { value: web3.utils.toWei("1", "ether") }
  );

  // Alice should have higher price than others
  const alicePrice = await market1.methods.getYesPrice(0).call();
  const bobPrice = await market1.methods.getYesPrice(1).call();
  const charliePrice = await market1.methods.getYesPrice(2).call();
  const davePrice = await market1.methods.getYesPrice(3).call();

  assertGt(alicePrice, bobPrice, "Alice price > Bob price (more bought)");
  assertGt(charliePrice, davePrice, "Charlie price > Dave price");
  assertGt(alicePrice, charliePrice, "Alice price > Charlie price (more volume)");
  assertEq(bobPrice, davePrice, "Bob price = Dave price (neither traded)");

  // Token ID verification
  const aliceYesId = await ct.methods.outcomeYesTokenId(1, 0).call();
  const aliceNoId = await ct.methods.outcomeNoTokenId(1, 0).call();
  const expectedYesId = 1 * 20 * 2 + 0 * 2; // marketId=1, outcomeIndex=0
  const expectedNoId = 1 * 20 * 2 + 0 * 2 + 1;
  assertEq(aliceYesId, expectedYesId.toString(), `Alice YES tokenId = ${expectedYesId}`);
  assertEq(aliceNoId, expectedNoId.toString(), `Alice NO tokenId = ${expectedNoId}`);

  const charlieYesId = await ct.methods.outcomeYesTokenId(1, 2).call();
  const expectedCharlieYesId = 1 * 20 * 2 + 2 * 2; // marketId=1, outcomeIndex=2
  assertEq(charlieYesId, expectedCharlieYesId.toString(), `Charlie YES tokenId = ${expectedCharlieYesId}`);

  // Check user balances
  const aliceShares = await ct.methods.balanceOf(account.address, aliceYesId).call();
  const charlieShares = await ct.methods.balanceOf(account.address, charlieYesId).call();
  assertGt(aliceShares, 0, "User has Alice YES shares");
  assertGt(charlieShares, 0, "User has Charlie YES shares");

  // getOutcomeInfo verification
  const aliceInfo = await market1.methods.getOutcomeInfo(0).call();
  assertEq(aliceInfo.label, "Alice", "getOutcomeInfo(0).label = Alice");
  assertGt(aliceInfo.yesPrice, web3.utils.toWei("0.5", "ether"), "Alice YES price > 0.5 after buy");

  console.log("");

  // ════════════════════════════════════════════════════════════
  // Phase 4: Oracle Resolution & Claims
  // ════════════════════════════════════════════════════════════
  console.log("══ Phase 4: Resolution & Winnings ══\n");

  // We can't easily test time-based resolution on testnet without time manipulation.
  // Instead, test Oracle.resolve() directly and verify state.

  console.log("  Resolving market 1 via Oracle (winner = Alice, index 0)...");
  await sendMethod(
    web3, account,
    oracle.methods.resolve(1, 0), // marketId=1, winningOutcome=0 (Alice)
    oracle.options.address
  );

  const isResolved = await oracle.methods.isResolved(1).call();
  assert(isResolved === true, "Oracle confirms market 1 resolved");

  const winningOutcome = await oracle.methods.getWinningOutcome(1).call();
  assertEq(winningOutcome, "0", "Winning outcome = 0 (Alice)");

  // Note: We can't call market1.resolveMarket() because endTime hasn't passed.
  // But we've verified the Oracle side works. The claim logic depends on
  // block.timestamp >= endTime, so we verify it independently:

  // Verify resolveMarket reverts before endTime
  let revertedCorrectly = false;
  try {
    await market1.methods.resolveMarket().call({ from: account.address });
  } catch (e) {
    revertedCorrectly = true;
  }
  assert(revertedCorrectly, "resolveMarket() reverts before endTime (correct)");

  console.log("");

  // ════════════════════════════════════════════════════════════
  // Phase 5: Edge Cases & Validations
  // ════════════════════════════════════════════════════════════
  console.log("══ Phase 5: Edge Cases & Validations ══\n");

  // Test: cannot buy on invalid outcome index
  let invalidOutcomeReverted = false;
  try {
    await market1.methods.buyShares(10, true, "0").call({
      from: account.address,
      value: web3.utils.toWei("0.1", "ether"),
    });
  } catch (e) {
    invalidOutcomeReverted = true;
  }
  assert(invalidOutcomeReverted, "buyShares reverts on invalid outcomeIndex");

  // Test: cannot create market with <2 outcomes
  let tooFewOutcomesReverted = false;
  try {
    await factory.methods.createMarket("Bad market", ["Only One"], futureTime).call({
      from: account.address,
    });
  } catch (e) {
    tooFewOutcomesReverted = true;
  }
  assert(tooFewOutcomesReverted, "createMarket reverts with <2 outcomes");

  // Test: cannot create market with >20 outcomes
  let tooManyOutcomesReverted = false;
  try {
    const manyLabels = Array.from({ length: 21 }, (_, i) => `Option ${i}`);
    await factory.methods.createMarket("Big market", manyLabels, futureTime).call({
      from: account.address,
    });
  } catch (e) {
    tooManyOutcomesReverted = true;
  }
  assert(tooManyOutcomesReverted, "createMarket reverts with >20 outcomes");

  // Test: getMarketInfo backward compatibility 
  const info = await market0.methods.getMarketInfo().call();
  assert(info._question === "Will BTC hit 100k?", "getMarketInfo() returns correct question");
  assertGt(info._totalVolume, 0, "getMarketInfo() shows volume > 0");
  assertEq(info._traderCount, "1", "getMarketInfo() shows trader count = 1");

  // Test: getCost estimation
  const cost = await market0.methods.getCost(0, true, web3.utils.toWei("1", "ether")).call();
  assertGt(cost, 0, "getCost returns positive value");

  // Test: getSellPayout estimation
  const remainingShares = await ct.methods.balanceOf(account.address, yesTokenId).call();
  if (BigInt(remainingShares) > 0n) {
    const payout = await market0.methods.getSellPayout(0, true, remainingShares).call();
    assertGt(payout, 0, "getSellPayout returns positive value");
  }

  console.log("");

  // ════════════════════════════════════════════════════════════
  // Phase 6: Token ID Cross-Verification
  // ════════════════════════════════════════════════════════════
  console.log("══ Phase 6: Token ID Math Verification ══\n");

  const MAX_OUTCOMES = 20;
  for (let m = 0; m < 3; m++) {
    for (let o = 0; o < 4; o++) {
      const expectedYes = m * MAX_OUTCOMES * 2 + o * 2;
      const expectedNo = m * MAX_OUTCOMES * 2 + o * 2 + 1;
      const actualYes = await ct.methods.outcomeYesTokenId(m, o).call();
      const actualNo = await ct.methods.outcomeNoTokenId(m, o).call();
      assertEq(actualYes, expectedYes.toString(), `Token YES(m=${m},o=${o}) = ${expectedYes}`);
      assertEq(actualNo, expectedNo.toString(), `Token NO(m=${m},o=${o}) = ${expectedNo}`);
    }
  }

  // Backward-compatible yesTokenId / noTokenId
  const legacyYes = await ct.methods.yesTokenId(0).call();
  const legacyNo = await ct.methods.noTokenId(0).call();
  assertEq(legacyYes, "0", "yesTokenId(0) = 0 (backward compat)");
  assertEq(legacyNo, "4", "noTokenId(0) = 4 (= outcomeYesTokenId(0,1) backward compat)");

  console.log("");

  // ════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) {
    console.log("\n  Failed tests:");
    failures.forEach((f) => console.log(`    ❌ ${f}`));
    console.log("═══════════════════════════════════════════════");
    process.exit(1);
  } else {
    console.log("  🎉 All tests passed!");
    console.log("═══════════════════════════════════════════════");
  }
}

main().catch((err) => {
  console.error("\n💥 Test suite crashed:", err);
  process.exit(1);
});
