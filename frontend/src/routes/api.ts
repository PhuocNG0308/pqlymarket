import { Router, Request, Response } from "express";
import { getMarkets, getLeaderboard, getPortfolio, getProfileData } from "../services/blockchain";
import { CONTRACTS, CHAIN_ID, RPC_URL } from "../config/contracts";
import path from "path";
import fs from "fs";
import { ethers } from "ethers";
import { QrlJsonRpcProvider } from "../services/qrl-provider";
import Web3 from "@theqrl/web3";
import { strictLimiter } from "../middlewares/limiters";
export const apiRouter = Router();

// ==========================================
// 🚀 Public RPC Proxy (CORS & Mixed Content Bypass)
// ==========================================
apiRouter.post("/rpc", async (req: Request, res: Response) => {
  try {
    const fetchRes = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await fetchRes.json();
    return res.json(data);
  } catch (error: any) {
    console.error("[RPC Proxy Error]:", error.message);
    return res.status(502).json({ error: "Failed to connect to blockchain node" });
  }
});

// Load ABI helper (server-side, Hyperion artifacts)
function loadABI(contractName: string): ethers.InterfaceAbi {
  const abiPath = path.join(
    __dirname,
    `../../../artifacts/${contractName}.json`
  );
  if (fs.existsSync(abiPath)) {
    const artifact = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    return artifact.abi;
  }
  return [];
}

// Get all markets (optionally filtered by category)
apiRouter.get("/markets", async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const markets = await getMarkets(category);
  res.json({ markets });
});

// (Group endpoints removed — multi-outcome is now native to markets)

// Get contract addresses and chain config
apiRouter.get("/config", (_req: Request, res: Response) => {
  res.json({
    contracts: CONTRACTS,
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
  });
});

// Get leaderboard data from SQLite (indexed from chain events)
// Supports ?period=day|week|month|all and ?type=volume|profit
apiRouter.get("/leaderboard", async (req: Request, res: Response) => {
  const period = (req.query.period as string) || "all";
  const type = (req.query.type as string) || "volume";
  const validPeriods = ["day", "week", "month", "all"];
  const validTypes = ["volume", "profit"];
  const entries = await getLeaderboard(
    validPeriods.includes(period) ? period as any : "all",
    validTypes.includes(type) ? type as any : "volume"
  );
  res.json({ success: true, data: entries });
});

// Get profile data for a specific address
apiRouter.get("/profile/:address", async (req: Request, res: Response) => {
  const address = req.params.address as string;
  if (!address || !address.match(/^(0x|Z|Q)[0-9a-fA-F]{40}$/)) {
    res.status(400).json({ success: false, error: "Invalid address" });
    return;
  }
  try {
    const profile = await getProfileData(address);
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch profile" });
  }
});

// Trigger manual sync of blockchain events into SQLite
apiRouter.post("/sync", strictLimiter, async (_req: Request, res: Response) => {
  const { syncEvents } = await import("../services/indexer");
  const inserted = await syncEvents();
  res.json({ success: true, newTrades: inserted });
});

// Get AMM pool reserves for a market (for client-side estimation)
apiRouter.get("/market-reserves/:marketId", async (req: Request, res: Response) => {
  try {
    const marketId = parseInt(req.params.marketId as string, 10);
    const outcomeIndex = parseInt((req.query.outcome as string) || "0", 10);
    if (isNaN(marketId) || marketId < 0) {
      res.status(400).json({ success: false, error: "Invalid market ID" });
      return;
    }
    const provider = new QrlJsonRpcProvider(RPC_URL);
    const factoryAbi = loadABI("MarketFactory");
    const marketAbi = loadABI("PredictionMarket");
    const factory = new ethers.Contract(CONTRACTS.MarketFactory, factoryAbi, provider);
    const marketAddr = await factory.markets(marketId);
    const market = new ethers.Contract(marketAddr, marketAbi, provider);
    const [yesShares, noShares] = await Promise.all([
      market.yesSharesOf(outcomeIndex),
      market.noSharesOf(outcomeIndex),
    ]);
    res.json({
      success: true,
      yesShares: yesShares.toString(),
      noShares: noShares.toString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch reserves" });
  }
});

// Get portfolio for a specific address
apiRouter.get("/portfolio/:address", async (req: Request, res: Response) => {
  const address = req.params.address as string;
  if (!address || !address.match(/^(0x|Z|Q)[0-9a-fA-F]{40}$/)) {
    res.status(400).json({ success: false, error: "Invalid address" });
    return;
  }
  try {
    const positions = await getPortfolio(address);
    res.json({ success: true, data: positions });
  } catch (err) {
    console.error("Portfolio fetch error:", err);
    res.json({ success: false, data: [] });
  }
});

// ---- Faucet Endpoints ----

// Convert an address to Q-prefix for @theqrl/web3 (which expects Q-prefix)
function toQAddress(addr: string): string {
  if (addr.startsWith("0x")) return "Q" + addr.slice(2);
  if (addr.startsWith("Z")) return "Q" + addr.slice(1);
  return addr;
}

// Get a @theqrl/web3 instance with the deployer account for faucet claims
function loadDeployerHexseed(): string | null {
  // 1. Environment variable (highest priority)
  if (process.env.DEPLOYER_HEXSEED) return process.env.DEPLOYER_HEXSEED;
  // 2. deployment.json (written by deploy-qrl.js)
  try {
    const deployPath = path.join(__dirname, "..", "..", "..", "deployment.json");
    const raw = JSON.parse(fs.readFileSync(deployPath, "utf8"));
    if (raw.deployerHexseed) return raw.deployerHexseed;
  } catch {}
  return null;
}

function getWeb3WithDeployer(): { web3: any; account: any } | null {
  const hexseed = loadDeployerHexseed();
  if (!hexseed || !CONTRACTS.Faucet) return null;
  const web3 = new Web3(RPC_URL);
  const account = web3.qrl.accounts.seedToAccount(hexseed);
  console.log("[Faucet] Deployer address:", account.address);
  return { web3, account };
}

/**
 * Sign and send a contract method call using local signing.
 * gqrl requires qrl_sendRawTransaction (client-side signing) — 
 * qrl_sendTransaction only works for node-unlocked accounts.
 */
async function sendSignedMethod(
  web3: any, account: any, contractMethod: any, to: string, opts: { value?: string } = {}
): Promise<any> {
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

// Check faucet claim eligibility (on-chain only — resets with each chain restart)
apiRouter.get("/faucet/status", async (req: Request, res: Response) => {
  const address = req.query.address as string;
  if (!address || !address.match(/^(0x|Z|Q)[0-9a-fA-F]{40}$/)) {
    res.status(400).json({ eligible: false, reason: "Invalid address" });
    return;
  }

  // Check on-chain claim status (authoritative, resets on Docker/chain restart)
  if (!CONTRACTS.Faucet) {
    res.json({ eligible: false, reason: "Faucet not deployed" });
    return;
  }

  try {
    const provider = new QrlJsonRpcProvider(RPC_URL);
    const faucet = new ethers.Contract(CONTRACTS.Faucet, loadABI("Faucet"), provider);
    const claimed = await faucet.hasAddressClaimed(address);
    const balance = await faucet.getBalance();
    const claimAmount = await faucet.claimAmount();

    res.json({
      eligible: !claimed && balance >= claimAmount,
      claimed,
      balance: ethers.formatEther(balance),
      claimAmount: ethers.formatEther(claimAmount),
      reason: claimed ? "Address already claimed" : balance < claimAmount ? "Faucet empty" : null,
    });
  } catch (err) {
    console.error("Faucet status error:", err);
    res.json({ eligible: false, reason: "Cannot reach faucet contract" });
  }
});

// Server-side faucet claim: calls claimFor(recipient) so user needs zero gas
apiRouter.post("/faucet/claim", strictLimiter, async (req: Request, res: Response) => {
  const { address } = req.body;
  if (!address || !address.match(/^(0x|Z|Q)[0-9a-fA-F]{40}$/)) {
    res.status(400).json({ success: false, error: "Invalid address" });
    return;
  }

  const deployer = getWeb3WithDeployer();
  if (!deployer) {
    res.status(503).json({ success: false, error: "Faucet not configured (no deployer hexseed in deployment.json or DEPLOYER_HEXSEED env)" });
    return;
  }

  try {
    const { web3, account } = deployer;
    const faucetAddr = toQAddress(CONTRACTS.Faucet!);
    const abi = loadABI("Faucet");
    const faucet = new web3.qrl.Contract(abi as any, faucetAddr);

    // Check on-chain first
    const recipientQ = toQAddress(address);
    const claimed = await faucet.methods.hasAddressClaimed(recipientQ).call();
    if (claimed) {
      res.status(400).json({ success: false, error: "Address already claimed" });
      return;
    }

    // Call claimFor(recipient) — server signs locally, user receives QRL
    try {
      const claimMethod = faucet.methods.claimFor(recipientQ);
      const receipt = await sendSignedMethod(web3, account, claimMethod, faucetAddr);

      const claimAmountRaw = await faucet.methods.claimAmount().call();
      const claimAmountQrl = web3.utils.fromPlanck(claimAmountRaw.toString(), "quanta");

      res.json({
        success: true,
        txHash: receipt.transactionHash,
        amount: claimAmountQrl,
      });
    } catch (txErr: any) {
      console.error("Faucet claimFor error:", txErr);
      const msg = txErr.message || txErr.reason || "";
      if (msg.includes("Not owner")) {
        console.error("[Faucet] Deployer address:", account.address,
          "but the Faucet owner is different. Re-deploy or check deployment.json/DEPLOYER_HEXSEED.");
        res.status(500).json({ success: false, error: "Faucet misconfigured — deployer is not the contract owner. Please contact admin." });
      } else {
        res.status(500).json({ success: false, error: msg || "Claim failed" });
      }
      return;
    }
  } catch (err: any) {
    console.error("Faucet claim error:", err);
    const reason = err.reason || err.message || "Claim failed";
    res.status(500).json({ success: false, error: reason });
  }
});

// Get ABI for a specific contract
apiRouter.get("/abi/:contract", (req: Request, res: Response) => {
  const contractName = req.params.contract as string;
  const allowed = [
    "ConditionalToken",
    "MarketFactory",
    "Oracle",
    "GovernanceOracle",
    "PqlToken",
    "BondingCurve",
    "LiquidityPool",
    "PredictionMarket",
    "Faucet",
  ];

  if (!allowed.includes(contractName)) {
    res.status(400).json({ error: "Invalid contract name" });
    return;
  }

  const abiPath = path.join(
    __dirname,
    `../../../artifacts/${contractName}.json`
  );

  if (!fs.existsSync(abiPath)) {
    res.status(404).json({ error: "ABI not found" });
    return;
  }

  const artifact = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
  res.json({ abi: artifact.abi });
});

// Check if an address is an authorized market creator
apiRouter.get("/is-creator/:address", async (req: Request, res: Response) => {
  const address = req.params.address as string;
  if (!address || !address.match(/^(0x|Z|Q)[0-9a-fA-F]{40}$/)) {
    res.json({ isCreator: false });
    return;
  }
  try {
    const provider = new QrlJsonRpcProvider(RPC_URL);
    const factory = new ethers.Contract(CONTRACTS.MarketFactory, loadABI("MarketFactory"), provider);
    const isCreator = await factory.isMarketCreator(address);
    const owner = await factory.owner();
    res.json({ isCreator, isOwner: owner.toLowerCase() === address.toLowerCase() });
  } catch {
    res.json({ isCreator: false, isOwner: false });
  }
});

// Authorize a new market creator (admin-only, uses deployer hexseed)
apiRouter.post("/authorize-creator", strictLimiter, async (req: Request, res: Response) => {
  // Admin authentication: require ADMIN_SECRET header or env
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const provided = req.headers["x-admin-secret"] as string;
    if (provided !== adminSecret) {
      res.status(403).json({ error: "Forbidden: invalid admin credentials" });
      return;
    }
  }
  const { address } = req.body;
  if (!address || !address.match(/^(0x|Q)[0-9a-fA-F]{40}$/)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }

  // Load deployer hexseed from deployment.json or env
  const deployPath = path.join(__dirname, "../../../deployment.json");
  let hexseed = process.env.HEXSEED;
  if (!hexseed) {
    try {
      const deployment = JSON.parse(fs.readFileSync(deployPath, "utf8"));
      hexseed = deployment.deployerHexseed;
    } catch { /* ignore */ }
  }
  if (!hexseed) {
    res.status(500).json({ error: "Deployer hexseed not configured" });
    return;
  }

  // Normalize to Q-prefix
  let qAddress = address;
  if (qAddress.startsWith("0x")) qAddress = "Q" + qAddress.slice(2);

  try {
    const web3 = new Web3(RPC_URL);
    const account = web3.qrl.accounts.seedToAccount(hexseed);
    web3.qrl.accounts.wallet.add(account);

    const artifact = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../../artifacts/MarketFactory.json"), "utf8")
    );
    const factory = new web3.qrl.Contract(artifact.abi as any, CONTRACTS.MarketFactory.replace("0x", "Q"));

    // Check if already authorized
    const already = await (factory.methods as any).isMarketCreator(qAddress).call();
    if (already) {
      res.json({ success: true, message: "Already authorized" });
      return;
    }

    const method = (factory.methods as any).setMarketCreator(qAddress, true);
    const gas = await method.estimateGas({ from: account.address });
    const nonce = await web3.qrl.getTransactionCount(account.address, "latest");
    const block = await web3.qrl.getBlock("latest");
    const baseFee = BigInt(block.baseFeePerGas || 0);
    const maxPriorityFee = BigInt(web3.utils.toPlanck("1", "shor"));
    const maxFee = baseFee * 2n + maxPriorityFee;

    const txObj = {
      from: account.address,
      to: factory.options.address,
      data: method.encodeABI(),
      gas: Math.ceil(Number(gas) * 1.2).toString(),
      maxFeePerGas: maxFee.toString(),
      maxPriorityFeePerGas: maxPriorityFee.toString(),
      nonce: nonce.toString(),
      value: "0",
      chainId: CHAIN_ID,
      type: "0x2",
    };

    const signed = await account.signTransaction(txObj);
    const receipt = await web3.qrl.sendSignedTransaction(signed.rawTransaction);

    res.json({
      success: !!receipt.status,
      txHash: receipt.transactionHash,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Authorization failed" });
  }
});

// Get governance proposal info for a market
apiRouter.get("/governance/:marketId", async (req: Request, res: Response) => {
  const marketId = parseInt(req.params.marketId as string, 10);
  if (isNaN(marketId)) {
    res.status(400).json({ error: "Invalid marketId" });
    return;
  }
  try {
    const provider = new QrlJsonRpcProvider(RPC_URL);
    if (!CONTRACTS.GovernanceOracle) {
      res.json({ hasGovernance: false });
      return;
    }
    const govOracle = new ethers.Contract(CONTRACTS.GovernanceOracle, loadABI("GovernanceOracle"), provider);
    const isResolved = await govOracle.isResolved(marketId);
    const info = await govOracle.getProposalInfo(marketId);
    // info: proposedOutcome, proposer, proposerStake, proposedAt, state, disputer, disputerStake, counterOutcome, disputeAt, yesVotes, noVotes
    const stateNames = ["None", "Proposed", "Disputed", "Finalized"];
    const outcomeNames = ["Unresolved", "Yes", "No", "Invalid"];
    res.json({
      hasGovernance: true,
      isResolved,
      outcome: isResolved ? outcomeNames[Number(await govOracle.getOutcome(marketId))] : null,
      proposal: {
        proposedOutcome: outcomeNames[Number(info[0])],
        proposer: info[1],
        proposerStake: ethers.formatEther(info[2]),
        proposedAt: Number(info[3]),
        state: stateNames[Number(info[4])],
        stateNum: Number(info[4]),
        disputer: info[5],
        disputerStake: ethers.formatEther(info[6]),
        counterOutcome: outcomeNames[Number(info[7])],
        disputeAt: Number(info[8]),
        yesVotes: ethers.formatEther(info[9]),
        noVotes: ethers.formatEther(info[10]),
      },
    });
  } catch (err) {
    console.error("Governance fetch error:", err);
    res.json({ hasGovernance: false });
  }
});

// Get PQL token balance for an address
apiRouter.get("/pql-balance/:address", async (req: Request, res: Response) => {
  const address = req.params.address as string;
  if (!address || !address.match(/^(0x|Z)[0-9a-fA-F]{40}$/)) {
    res.json({ balance: "0" });
    return;
  }
  try {
    const provider = new QrlJsonRpcProvider(RPC_URL);
    if (!CONTRACTS.PqlToken) {
      res.json({ balance: "0" });
      return;
    }
    const pql = new ethers.Contract(CONTRACTS.PqlToken, loadABI("PqlToken"), provider);
    const balance = await pql.balanceOf(address);
    res.json({ balance: ethers.formatEther(balance) });
  } catch {
    res.json({ balance: "0" });
  }
});
