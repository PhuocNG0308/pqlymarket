import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(__dirname, "../../data/pqlymarket.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dir = path.dirname(DB_PATH);
    const fs = require("fs");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT UNIQUE NOT NULL,
      buyer TEXT NOT NULL,
      market_index INTEGER NOT NULL,
      market_address TEXT NOT NULL,
      is_yes INTEGER NOT NULL,
      amount TEXT NOT NULL,
      cost TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer);
    CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_index);
    CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);

    CREATE TABLE IF NOT EXISTS sells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT UNIQUE NOT NULL,
      seller TEXT NOT NULL,
      market_index INTEGER NOT NULL,
      market_address TEXT NOT NULL,
      is_yes INTEGER NOT NULL,
      shares TEXT NOT NULL,
      payout TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sells_seller ON sells(seller);
    CREATE INDEX IF NOT EXISTS idx_sells_market ON sells(market_index);
    CREATE INDEX IF NOT EXISTS idx_sells_timestamp ON sells(timestamp);

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT UNIQUE NOT NULL,
      user TEXT NOT NULL,
      market_index INTEGER NOT NULL,
      market_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_claims_user ON claims(user);

    CREATE TABLE IF NOT EXISTS resolutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_index INTEGER NOT NULL,
      market_address TEXT NOT NULL,
      outcome INTEGER NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp INTEGER DEFAULT 0,
      UNIQUE(market_index)
    );

    CREATE TABLE IF NOT EXISTS block_timestamps (
      block_number INTEGER PRIMARY KEY,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// --- Trade operations ---

export interface TradeRow {
  tx_hash: string;
  buyer: string;
  market_index: number;
  market_address: string;
  is_yes: number;
  amount: string;
  cost: string;
  block_number: number;
  timestamp: number;
}

export function insertTrade(trade: TradeRow): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO trades (tx_hash, buyer, market_index, market_address, is_yes, amount, cost, block_number, timestamp)
    VALUES (@tx_hash, @buyer, @market_index, @market_address, @is_yes, @amount, @cost, @block_number, @timestamp)
  `);
  const result = stmt.run(trade);
  return result.changes > 0;
}

export function insertTradesBatch(trades: TradeRow[]): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO trades (tx_hash, buyer, market_index, market_address, is_yes, amount, cost, block_number, timestamp)
    VALUES (@tx_hash, @buyer, @market_index, @market_address, @is_yes, @amount, @cost, @block_number, @timestamp)
  `);
  let inserted = 0;
  const tx = db.transaction((rows: TradeRow[]) => {
    for (const row of rows) {
      const result = stmt.run(row);
      inserted += result.changes;
    }
  });
  tx(trades);
  return inserted;
}

// --- Sell operations ---

export interface SellRow {
  tx_hash: string;
  seller: string;
  market_index: number;
  market_address: string;
  is_yes: number;
  shares: string;
  payout: string;
  block_number: number;
  timestamp: number;
}

export function insertSellsBatch(sells: SellRow[]): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO sells (tx_hash, seller, market_index, market_address, is_yes, shares, payout, block_number, timestamp)
    VALUES (@tx_hash, @seller, @market_index, @market_address, @is_yes, @shares, @payout, @block_number, @timestamp)
  `);
  let inserted = 0;
  const tx = db.transaction((rows: SellRow[]) => {
    for (const row of rows) {
      const result = stmt.run(row);
      inserted += result.changes;
    }
  });
  tx(sells);
  return inserted;
}

// --- Claim operations ---

export interface ClaimRow {
  tx_hash: string;
  user: string;
  market_index: number;
  market_address: string;
  amount: string;
  block_number: number;
  timestamp: number;
}

export function insertClaimsBatch(claims: ClaimRow[]): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO claims (tx_hash, user, market_index, market_address, amount, block_number, timestamp)
    VALUES (@tx_hash, @user, @market_index, @market_address, @amount, @block_number, @timestamp)
  `);
  let inserted = 0;
  const tx = db.transaction((rows: ClaimRow[]) => {
    for (const row of rows) {
      const result = stmt.run(row);
      inserted += result.changes;
    }
  });
  tx(claims);
  return inserted;
}

// --- Resolution operations ---

export interface ResolutionRow {
  market_index: number;
  market_address: string;
  outcome: number;
  block_number: number;
  timestamp: number;
}

export function insertResolution(row: ResolutionRow): boolean {
  const db = getDb();
  const result = db.prepare(`
    INSERT OR IGNORE INTO resolutions (market_index, market_address, outcome, block_number, timestamp)
    VALUES (@market_index, @market_address, @outcome, @block_number, @timestamp)
  `).run(row);
  return result.changes > 0;
}

// --- Block timestamp cache ---

export function getCachedBlockTimestamps(blockNumbers: number[]): Map<number, number> {
  const db = getDb();
  const map = new Map<number, number>();
  if (blockNumbers.length === 0) return map;
  const placeholders = blockNumbers.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT block_number, timestamp FROM block_timestamps WHERE block_number IN (${placeholders})`)
    .all(...blockNumbers) as { block_number: number; timestamp: number }[];
  for (const r of rows) map.set(r.block_number, r.timestamp);
  return map;
}

export function insertBlockTimestamps(entries: { block_number: number; timestamp: number }[]) {
  const db = getDb();
  const stmt = db.prepare(`INSERT OR IGNORE INTO block_timestamps (block_number, timestamp) VALUES (?, ?)`);
  const tx = db.transaction((rows: typeof entries) => {
    for (const r of rows) stmt.run(r.block_number, r.timestamp);
  });
  tx(entries);
}

export function updateTradeTimestamps(blockTimestamps: Map<number, number>) {
  const db = getDb();
  const stmt = db.prepare(`UPDATE trades SET timestamp = ? WHERE block_number = ? AND timestamp = 0`);
  const stmtSells = db.prepare(`UPDATE sells SET timestamp = ? WHERE block_number = ? AND timestamp = 0`);
  const stmtClaims = db.prepare(`UPDATE claims SET timestamp = ? WHERE block_number = ? AND timestamp = 0`);
  const stmtRes = db.prepare(`UPDATE resolutions SET timestamp = ? WHERE block_number = ? AND timestamp = 0`);
  const tx = db.transaction(() => {
    for (const [block, ts] of blockTimestamps) {
      stmt.run(ts, block);
      stmtSells.run(ts, block);
      stmtClaims.run(ts, block);
      stmtRes.run(ts, block);
    }
  });
  tx();
}

// --- Leaderboard queries ---

export interface LeaderboardRow {
  buyer: string;
  total_volume: string; // bigint as string
  trade_count: number;
  market_count: number;
  profit: string; // bigint as string (can be negative)
}

export function getLeaderboardFromDb(
  period: "day" | "week" | "month" | "all" = "all",
  type: "volume" | "profit" = "volume"
): LeaderboardRow[] {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  let since = 0;
  if (period === "day") since = now - 86400;
  else if (period === "week") since = now - 7 * 86400;
  else if (period === "month") since = now - 30 * 86400;

  const timeFilter = period === "all" ? "" : `WHERE timestamp > ${since}`;

  // Buy data (trades)
  const buyRows = db.prepare(`SELECT buyer, market_index, cost FROM trades ${timeFilter}`)
    .all() as { buyer: string; market_index: number; cost: string }[];

  // Sell data
  const sellRows = db.prepare(`SELECT seller, market_index, payout FROM sells ${timeFilter.replace("buyer", "seller")}`)
    .all() as { seller: string; market_index: number; payout: string }[];

  // Claim data
  const claimRows = db.prepare(`SELECT user, market_index, amount FROM claims ${timeFilter.replace("buyer", "user")}`)
    .all() as { user: string; market_index: number; amount: string }[];

  // Aggregate per address
  const map = new Map<string, {
    buyVolume: bigint; sellVolume: bigint; claimAmount: bigint;
    trades: number; markets: Set<number>;
  }>();

  function getEntry(addr: string) {
    let e = map.get(addr);
    if (!e) {
      e = { buyVolume: BigInt(0), sellVolume: BigInt(0), claimAmount: BigInt(0), trades: 0, markets: new Set() };
      map.set(addr, e);
    }
    return e;
  }

  for (const r of buyRows) {
    const e = getEntry(r.buyer);
    e.buyVolume += BigInt(r.cost || "0");
    e.trades++;
    e.markets.add(r.market_index);
  }
  for (const r of sellRows) {
    const e = getEntry(r.seller);
    e.sellVolume += BigInt(r.payout || "0");
    e.trades++;
    e.markets.add(r.market_index);
  }
  for (const r of claimRows) {
    const e = getEntry(r.user);
    e.claimAmount += BigInt(r.amount || "0");
    e.markets.add(r.market_index);
  }

  const entries = Array.from(map.entries()).map(([addr, data]) => {
    const totalVolume = data.buyVolume + data.sellVolume;
    const profit = data.sellVolume + data.claimAmount - data.buyVolume;
    return { buyer: addr, totalVolume, profit, trades: data.trades, markets: data.markets.size };
  });

  if (type === "profit") {
    entries.sort((a, b) => (b.profit > a.profit ? 1 : b.profit < a.profit ? -1 : 0));
  } else {
    entries.sort((a, b) => (b.totalVolume > a.totalVolume ? 1 : b.totalVolume < a.totalVolume ? -1 : 0));
  }

  return entries.map((e) => ({
    buyer: e.buyer,
    total_volume: e.totalVolume.toString(),
    trade_count: e.trades,
    market_count: e.markets,
    profit: e.profit.toString(),
  }));
}

// --- Cost basis for portfolio PnL ---

export function getCostBasis(address: string, marketIndex: number, isYes: number): string {
  const db = getDb();
  const rows = db.prepare(
    `SELECT cost FROM trades WHERE buyer = ? AND market_index = ? AND is_yes = ?`
  ).all(address, marketIndex, isYes) as { cost: string }[];
  let total = BigInt(0);
  for (const r of rows) total += BigInt(r.cost || "0");
  return total.toString();
}

export function getSellProceeds(address: string, marketIndex: number, isYes: number): string {
  const db = getDb();
  const rows = db.prepare(
    `SELECT payout FROM sells WHERE seller = ? AND market_index = ? AND is_yes = ?`
  ).all(address, marketIndex, isYes) as { payout: string }[];
  let total = BigInt(0);
  for (const r of rows) total += BigInt(r.payout || "0");
  return total.toString();
}

// --- Profile queries ---

export interface ProfileTradeRow {
  type: "buy" | "sell" | "claim";
  tx_hash: string;
  market_index: number;
  market_address: string;
  is_yes: number;
  amount: string;
  cost_or_payout: string;
  block_number: number;
  timestamp: number;
}

export function getProfileTrades(address: string): ProfileTradeRow[] {
  const db = getDb();
  const buys = db.prepare(
    `SELECT 'buy' as type, tx_hash, market_index, market_address, is_yes, amount, cost as cost_or_payout, block_number, timestamp FROM trades WHERE buyer = ? ORDER BY block_number DESC`
  ).all(address) as ProfileTradeRow[];

  const sells = db.prepare(
    `SELECT 'sell' as type, tx_hash, market_index, market_address, is_yes, shares as amount, payout as cost_or_payout, block_number, timestamp FROM sells WHERE seller = ? ORDER BY block_number DESC`
  ).all(address) as ProfileTradeRow[];

  const claims = db.prepare(
    `SELECT 'claim' as type, tx_hash, market_index, market_address, 0 as is_yes, amount, amount as cost_or_payout, block_number, timestamp FROM claims WHERE user = ? ORDER BY block_number DESC`
  ).all(address) as ProfileTradeRow[];

  return [...buys, ...sells, ...claims].sort((a, b) => b.block_number - a.block_number);
}

export function getUserStats(address: string): {
  totalVolume: string; profit: string; totalTrades: number; marketsTraded: number;
  wins: number; losses: number;
} {
  const db = getDb();
  const buys = db.prepare(`SELECT cost, market_index FROM trades WHERE buyer = ?`).all(address) as { cost: string; market_index: number }[];
  const sells = db.prepare(`SELECT payout, market_index FROM sells WHERE seller = ?`).all(address) as { payout: string; market_index: number }[];
  const claims = db.prepare(`SELECT amount FROM claims WHERE user = ?`).all(address) as { amount: string }[];

  let buyTotal = BigInt(0);
  let sellTotal = BigInt(0);
  let claimTotal = BigInt(0);
  const markets = new Set<number>();

  for (const r of buys) { buyTotal += BigInt(r.cost || "0"); markets.add(r.market_index); }
  for (const r of sells) { sellTotal += BigInt(r.payout || "0"); markets.add(r.market_index); }
  for (const r of claims) { claimTotal += BigInt(r.amount || "0"); }

  return {
    totalVolume: (buyTotal + sellTotal).toString(),
    profit: (sellTotal + claimTotal - buyTotal).toString(),
    totalTrades: buys.length + sells.length,
    marketsTraded: markets.size,
    wins: claims.length,
    losses: 0, // detected on resolution events, simplified for now
  };
}

export function getPortfolioHistory(address: string): { day: string; netFlow: string }[] {
  const db = getDb();
  // Get all buy/sell/claim events for this address with timestamps, grouped by day
  const buys = db.prepare(
    `SELECT date(timestamp, 'unixepoch') as day, cost FROM trades WHERE buyer = ? AND timestamp > 0`
  ).all(address) as { day: string; cost: string }[];
  const sells = db.prepare(
    `SELECT date(timestamp, 'unixepoch') as day, payout FROM sells WHERE seller = ? AND timestamp > 0`
  ).all(address) as { day: string; payout: string }[];
  const claims = db.prepare(
    `SELECT date(timestamp, 'unixepoch') as day, amount FROM claims WHERE user = ? AND timestamp > 0`
  ).all(address) as { day: string; amount: string }[];

  // Cumulative net flow per day: - buys + sells + claims
  const dayMap = new Map<string, bigint>();
  for (const r of buys) {
    const prev = dayMap.get(r.day) || BigInt(0);
    dayMap.set(r.day, prev - BigInt(r.cost || "0"));
  }
  for (const r of sells) {
    const prev = dayMap.get(r.day) || BigInt(0);
    dayMap.set(r.day, prev + BigInt(r.payout || "0"));
  }
  for (const r of claims) {
    const prev = dayMap.get(r.day) || BigInt(0);
    dayMap.set(r.day, prev + BigInt(r.amount || "0"));
  }

  return Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, netFlow]) => ({ day, netFlow: netFlow.toString() }));
}

// --- Daily volume (for charts) ---

export interface DailyVolumeRow {
  day: string; // YYYY-MM-DD
  volume: string; // bigint as string
}

export function getDailyVolume(days: number = 30): DailyVolumeRow[] {
  const db = getDb();
  // Aggregate in JS to avoid SQLite integer overflow on wei values
  const rows = db
    .prepare(
      `
    SELECT
      date(timestamp, 'unixepoch') as day,
      cost
    FROM trades
    WHERE timestamp > 0
    ORDER BY day ASC
  `
    )
    .all() as { day: string; cost: string }[];

  const map = new Map<string, bigint>();
  for (const row of rows) {
    const prev = map.get(row.day) || BigInt(0);
    map.set(row.day, prev + BigInt(row.cost || "0"));
  }

  return Array.from(map.entries())
    .slice(-days)
    .map(([day, volume]) => ({ day, volume: volume.toString() }));
}

// --- Sync state ---

export function getSyncStateValue(key: string): string | undefined {
  const db = getDb();
  const row = db
    .prepare(`SELECT value FROM sync_state WHERE key = ?`)
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSyncStateValue(key: string, value: string) {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)`
  ).run(key, value);
}

export function getLastSyncedBlock(): number {
  const val = getSyncStateValue("last_synced_block");
  return val ? parseInt(val, 10) : 0;
}

export function setLastSyncedBlock(block: number) {
  setSyncStateValue("last_synced_block", block.toString());
}

export function getStoredGenesisHash(): string | undefined {
  return getSyncStateValue("genesis_block_hash");
}

export function setStoredGenesisHash(hash: string) {
  setSyncStateValue("genesis_block_hash", hash);
}

/**
 * Wipe all trade data and reset sync state.
 * Called when we detect the chain has been restarted (new genesis).
 */
export function resetDatabase() {
  const db = getDb();
  db.exec(`
    DELETE FROM trades;
    DELETE FROM sells;
    DELETE FROM claims;
    DELETE FROM resolutions;
    DELETE FROM block_timestamps;
    DELETE FROM sync_state;
  `);
  console.log("[Database] All data wiped (chain restart detected)");
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
