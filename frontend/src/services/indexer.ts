import { ethers } from "ethers";
import { CONTRACTS, RPC_URL } from "../config/contracts";
import { QrlJsonRpcProvider } from "./qrl-provider";
import {
  insertTradesBatch,
  insertSellsBatch,
  insertClaimsBatch,
  insertResolution,
  getCachedBlockTimestamps,
  insertBlockTimestamps,
  updateTradeTimestamps,
  getLastSyncedBlock,
  setLastSyncedBlock,
  getSyncStateValue,
  setSyncStateValue,
  getStoredGenesisHash,
  setStoredGenesisHash,
  resetDatabase,
  TradeRow,
  SellRow,
  ClaimRow,
  ResolutionRow,
} from "./database";
import { createHash } from "crypto";
import path from "path";
import fs from "fs";

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

const MarketFactoryABI = loadABI("MarketFactory");
const PredictionMarketABI = loadABI("PredictionMarket");

let syncing = false;

/**
 * Check if the blockchain has been restarted (new genesis).
 * Compares current genesis block hash with stored one.
 * If different, wipes the DB and stores the new genesis hash.
 */
async function checkChainReset(): Promise<void> {
  try {
    const provider = new QrlJsonRpcProvider(RPC_URL);
    const genesisBlock = await provider.getBlock(0);
    if (!genesisBlock) return;

    const currentGenesisHash = genesisBlock.hash;
    const storedGenesisHash = getStoredGenesisHash();

    if (storedGenesisHash && storedGenesisHash !== currentGenesisHash) {
      console.log("[Indexer] Chain reset detected! Old genesis:", storedGenesisHash?.substring(0, 16), "New:", currentGenesisHash?.substring(0, 16));
      resetDatabase();
    }

    if (currentGenesisHash) {
      setStoredGenesisHash(currentGenesisHash);
    }
  } catch (err) {
    console.warn("[Indexer] Could not check genesis block:", err);
  }
}

/**
 * Check if the deployed contract addresses have changed.
 * Computes a hash of all contract addresses and compares with stored value.
 * If different (i.e. contracts were redeployed), wipes the DB.
 */
function checkDeploymentChange(): void {
  try {
    const addrString = Object.entries(CONTRACTS).sort().map(([k, v]) => `${k}=${v}`).join(';');
    const currentHash = createHash('sha256').update(addrString).digest('hex').substring(0, 16);
    const storedHash = getSyncStateValue('deployment_hash');

    if (storedHash && storedHash !== currentHash) {
      console.log("[Indexer] Contract redeployment detected! Resetting indexed data.");
      resetDatabase();
    }
    setSyncStateValue('deployment_hash', currentHash);
  } catch (err) {
    console.warn("[Indexer] Could not check deployment hash:", err);
  }
}

/**
 * Index SharesBought, SharesSold, WinningsClaimed, MarketResolved events
 * from the blockchain into SQLite. Resumes from the last synced block.
 */
export async function syncEvents(): Promise<number> {
  if (syncing) return 0;
  syncing = true;

  try {
    const provider = new QrlJsonRpcProvider(RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    const lastSynced = getLastSyncedBlock();

    // Safety check: if lastSynced > currentBlock, chain was likely reset
    if (lastSynced > currentBlock) {
      console.log("[Indexer] lastSynced (" + lastSynced + ") > currentBlock (" + currentBlock + ") — resetting DB");
      resetDatabase();
    }

    if (currentBlock <= getLastSyncedBlock()) {
      return 0;
    }

    const factory = new ethers.Contract(
      CONTRACTS.MarketFactory,
      MarketFactoryABI,
      provider
    );

    let marketCount: number;
    try {
      marketCount = Number(await factory.marketCount());
    } catch {
      console.warn("[Indexer] Cannot reach MarketFactory, skipping sync");
      return 0;
    }

    const fromBlock = lastSynced > 0 ? lastSynced + 1 : 0;
    const trades: TradeRow[] = [];
    const sells: SellRow[] = [];
    const claims: ClaimRow[] = [];
    const blockNumbers = new Set<number>();

    for (let i = 0; i < marketCount; i++) {
      try {
        const marketAddr = await factory.markets(i);
        const market = new ethers.Contract(
          marketAddr,
          PredictionMarketABI,
          provider
        );

        // SharesBought events
        const buyFilter = market.filters.SharesBought();
        const buyEvents = await market.queryFilter(buyFilter, fromBlock, currentBlock);
        for (const event of buyEvents) {
          const log = event as ethers.EventLog;
          if (!log.args || !log.transactionHash) continue;
          blockNumbers.add(log.blockNumber);
          trades.push({
            tx_hash: log.transactionHash,
            buyer: log.args[0] as string,
            market_index: i,
            market_address: marketAddr,
            is_yes: (log.args[1] as boolean) ? 1 : 0,
            amount: (log.args[2] as bigint).toString(),
            cost: (log.args[3] as bigint).toString(),
            block_number: log.blockNumber,
            timestamp: 0,
          });
        }

        // SharesSold events
        const sellFilter = market.filters.SharesSold();
        const sellEvents = await market.queryFilter(sellFilter, fromBlock, currentBlock);
        for (const event of sellEvents) {
          const log = event as ethers.EventLog;
          if (!log.args || !log.transactionHash) continue;
          blockNumbers.add(log.blockNumber);
          sells.push({
            tx_hash: log.transactionHash,
            seller: log.args[0] as string,
            market_index: i,
            market_address: marketAddr,
            is_yes: (log.args[1] as boolean) ? 1 : 0,
            shares: (log.args[2] as bigint).toString(),
            payout: (log.args[3] as bigint).toString(),
            block_number: log.blockNumber,
            timestamp: 0,
          });
        }

        // WinningsClaimed events
        const claimFilter = market.filters.WinningsClaimed();
        const claimEvents = await market.queryFilter(claimFilter, fromBlock, currentBlock);
        for (const event of claimEvents) {
          const log = event as ethers.EventLog;
          if (!log.args || !log.transactionHash) continue;
          blockNumbers.add(log.blockNumber);
          claims.push({
            tx_hash: log.transactionHash,
            user: log.args[0] as string,
            market_index: i,
            market_address: marketAddr,
            amount: (log.args[1] as bigint).toString(),
            block_number: log.blockNumber,
            timestamp: 0,
          });
        }

        // MarketResolved events
        const resolveFilter = market.filters.MarketResolved();
        const resolveEvents = await market.queryFilter(resolveFilter, fromBlock, currentBlock);
        for (const event of resolveEvents) {
          const log = event as ethers.EventLog;
          if (!log.args) continue;
          blockNumbers.add(log.blockNumber);
          insertResolution({
            market_index: i,
            market_address: marketAddr,
            outcome: Number(log.args[1]),
            block_number: log.blockNumber,
            timestamp: 0,
          });
        }
      } catch (err) {
        console.warn(`[Indexer] Error indexing market ${i}:`, err);
      }
    }

    // Batch insert all events
    let totalInserted = 0;
    if (trades.length > 0) totalInserted += insertTradesBatch(trades);
    if (sells.length > 0) totalInserted += insertSellsBatch(sells);
    if (claims.length > 0) totalInserted += insertClaimsBatch(claims);

    // Fetch and cache block timestamps for all new events
    if (blockNumbers.size > 0) {
      const blocks = Array.from(blockNumbers);
      const cached = getCachedBlockTimestamps(blocks);
      const missing = blocks.filter((b) => !cached.has(b));

      // Fetch missing block timestamps from chain
      const newTimestamps: { block_number: number; timestamp: number }[] = [];
      for (const blockNum of missing) {
        try {
          const block = await provider.getBlock(blockNum);
          if (block && block.timestamp) {
            const ts = Number(block.timestamp);
            cached.set(blockNum, ts);
            newTimestamps.push({ block_number: blockNum, timestamp: ts });
          }
        } catch {
          // skip — will retry on next sync
        }
      }
      if (newTimestamps.length > 0) insertBlockTimestamps(newTimestamps);

      // Update all event rows with timestamps
      updateTradeTimestamps(cached);
    }

    setLastSyncedBlock(currentBlock);

    if (totalInserted > 0) {
      console.log(
        `[Indexer] Synced ${totalInserted} events (blocks ${fromBlock}-${currentBlock})` +
        ` — ${trades.length} buys, ${sells.length} sells, ${claims.length} claims`
      );
    }

    return totalInserted;
  } catch (err) {
    console.error("[Indexer] Sync failed:", err);
    return 0;
  } finally {
    syncing = false;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic background sync (every 15 seconds).
 * Checks for chain reset on startup to wipe stale data.
 */
export function startIndexer(intervalMs = 15_000) {
  // Check for chain reset and deployment changes first, then initial sync
  checkChainReset()
    .then(() => {
      checkDeploymentChange();
      return syncEvents();
    })
    .catch(console.error);

  // Periodic sync
  intervalId = setInterval(() => {
    syncEvents().catch(console.error);
  }, intervalMs);

  console.log(`[Indexer] Background sync started (every ${intervalMs / 1000}s)`);
}

export function stopIndexer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
