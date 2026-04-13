import { ethers } from "ethers";
import { CONTRACTS, RPC_URL } from "../config/contracts";
import { QrlJsonRpcProvider } from "./qrl-provider";
import {
  MarketData,
  MarketOutcome,
  FeaturedMarket,
  PriceTrend,
  SentimentData,
  VolumeChart,
  LeaderboardEntry,
  PortfolioPosition,
  ProfileData,
  ProfileTrade,
  PortfolioHistoryPoint,
} from "../types";
import path from "path";
import fs from "fs";

// Load ABIs from Hyperion-compiled artifacts
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
const ConditionalTokenABI = loadABI("ConditionalToken");

let provider: QrlJsonRpcProvider | null = null;

function getProvider(): QrlJsonRpcProvider {
  if (!provider) {
    provider = new QrlJsonRpcProvider(RPC_URL);
  }
  return provider;
}

function formatVolume(weiValue: bigint): string {
  const qrl = Number(ethers.formatEther(weiValue));
  if (qrl >= 1_000_000) return `${(qrl / 1_000_000).toFixed(1)}M QRL`;
  if (qrl >= 1_000) return `${(qrl / 1_000).toFixed(1)}k QRL`;
  return `${qrl.toFixed(2)} QRL`;
}

function formatTraders(count: bigint): string {
  const n = Number(count);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function categorizeMarket(question: string): "BTC" | "QRL" {
  const q = question.toLowerCase();
  if (q.includes("btc") || q.includes("bitcoin") || q.includes("etf")) {
    return "BTC";
  }
  return "QRL";
}

function getMarketIcon(category: "BTC" | "QRL"): string {
  return category === "QRL" ? "shield" : "currency_bitcoin";
}

export async function getMarkets(
  category?: string
): Promise<MarketData[]> {
  try {
    const p = getProvider();
    // Quick connectivity check
    await p.getBlockNumber();

    const factory = new ethers.Contract(
      CONTRACTS.MarketFactory,
      MarketFactoryABI,
      p
    );

    const marketCount = await factory.marketCount();
    const markets: MarketData[] = [];

    for (let i = 0; i < Number(marketCount); i++) {
      try {
        const marketAddr: string = await factory.markets(i);
        const market = new ethers.Contract(
          marketAddr,
          PredictionMarketABI,
          p
        );

        const info = await market.getMarketInfo();
        const question: string = info[0];
        const endTime: bigint = info[1];
        const status: bigint = info[2];
        const yesPrice: bigint = info[3];
        const noPrice: bigint = info[4];
        const _liquidity: bigint = info[5];
        const totalVolume: bigint = info[6];
        const traderCount: bigint = info[7];

        const cat = categorizeMarket(question);
        if (category && cat !== category) continue;

        const yesPriceCents = Math.round(
          Number(ethers.formatEther(yesPrice)) * 100
        );
        const noPriceCents = Math.round(
          Number(ethers.formatEther(noPrice)) * 100
        );

        // Fetch multi-outcome data
        const outcomeCount = Number(await market.outcomeCount());
        const outcomes: MarketOutcome[] = [];

        for (let j = 0; j < outcomeCount; j++) {
          try {
            const outcomeInfo = await market.getOutcomeInfo(j);
            const label: string = outcomeInfo[0];
            const oYesPrice: bigint = outcomeInfo[1];
            const oNoPrice: bigint = outcomeInfo[2];
            outcomes.push({
              outcomeIndex: j,
              label,
              yesPrice: Math.round(Number(ethers.formatEther(oYesPrice)) * 100),
              noPrice: Math.round(Number(ethers.formatEther(oNoPrice)) * 100),
            });
          } catch { /* skip */ }
        }

        markets.push({
          id: i,
          question,
          category: cat,
          outcomeCount,
          outcomes,
          yesPrice: yesPriceCents,
          noPrice: noPriceCents,
          volume: formatVolume(totalVolume),
          traders: formatTraders(traderCount),
          endDate: new Date(Number(endTime) * 1000).toLocaleDateString(),
          resolved: Number(status) === 1,
          icon: getMarketIcon(cat),
          liquidity: formatVolume(_liquidity),
          address: marketAddr,
        });
      } catch {
        // skip broken markets
      }
    }

    return markets;
  } catch (err) {
    console.error("Failed to fetch markets from chain:", err);
    return [];
  }
}

export async function getFeaturedMarket(category?: string): Promise<FeaturedMarket | null> {
  try {
    const markets = await getMarkets(category);
    if (markets.length === 0) {
      if (category) {
        // If there are no featured markets in a category, return null
        return null;
      }
      return null;
    }

    // Since getMarkets already filters by category, the first item is correct
    const featured = markets[0];

    return {
      ...featured,
      totalBets: featured.traders,
      chanceOfYes: featured.yesPrice,
    };
  } catch (err) {
    return null;
  }
}

export async function getAggregateStats(): Promise<{
  totalVolume: bigint;
  totalTraders: bigint;
  totalMarkets: number;
  avgBullish: number;
}> {
  try {
    const p = getProvider();
    await p.getBlockNumber();

    const factory = new ethers.Contract(
      CONTRACTS.MarketFactory,
      MarketFactoryABI,
      p
    );

    const marketCount = Number(await factory.marketCount());
    let totalVolume = BigInt(0);
    let totalTraders = BigInt(0);
    let yesPriceSum = 0;
    let priceCount = 0;

    for (let i = 0; i < marketCount; i++) {
      try {
        const marketAddr = await factory.markets(i);
        const market = new ethers.Contract(marketAddr, PredictionMarketABI, p);
        const info = await market.getMarketInfo();
        totalVolume += info[6];
        totalTraders += info[7];
        yesPriceSum += Number(ethers.formatEther(info[3])) * 100;
        priceCount++;
      } catch {
        // skip
      }
    }

    return {
      totalVolume,
      totalTraders,
      totalMarkets: marketCount,
      avgBullish: priceCount > 0 ? Math.round(yesPriceSum / priceCount) : 50,
    };
  } catch {
    return { totalVolume: BigInt(0), totalTraders: BigInt(0), totalMarkets: 0, avgBullish: 50 };
  }
}

export async function getSentiment(): Promise<SentimentData> {
  const stats = await getAggregateStats();
  const bullish = stats.avgBullish;
  const signal = bullish >= 60 ? "BULL" : bullish <= 40 ? "BEAR" : "NEUTRAL";
  const signalLabel = bullish >= 70 ? "Strong Signal" : bullish >= 55 ? "Moderate Signal" : "Weak Signal";

  return {
    bullishPercent: bullish,
    signal,
    activePositions: formatTraders(stats.totalTraders),
    openInterest: formatVolume(stats.totalVolume),
  };
}

export async function getVolumeChart(): Promise<VolumeChart> {
  try {
    const { getDailyVolume } = await import("./database");
    const rows = getDailyVolume(30);

    if (rows.length === 0) {
      return { labels: [], data: [], monthlyGrowth: "+0%" };
    }

    const labels = rows.map((r) => {
      const d = new Date(r.day + "T00:00:00Z");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
    const data = rows.map((r) =>
      Math.round(Number(ethers.formatEther(BigInt(r.volume))))
    );

    const first = data[0] || 1;
    const last = data[data.length - 1] || 0;
    const growth =
      first > 0
        ? `+${(((last - first) / first) * 100).toFixed(1)}%`
        : "+0%";

    return { labels, data, monthlyGrowth: growth };
  } catch {
    return { labels: [], data: [], monthlyGrowth: "+0%" };
  }
}

export async function getQRLPriceTrend(category: string = "QRL"): Promise<PriceTrend> {
  try {
    const markets = await getMarkets(category);
    const labelPrefix = category === "BTC" ? "BTC" : "QRL";
    
    if (markets.length > 0) {
      const featured = markets[0];
      const priceCents = featured.yesPrice;
      // Each bar = one market's YES price (no padding)
      const bars = markets.map((m) => m.yesPrice);

      return {
        label: `${labelPrefix} Market Confidence`,
        currentPrice: `${priceCents}¢`,
        change24h: `${markets.length} market${markets.length > 1 ? "s" : ""}`,
        bars,
      };
    }
    
    return {
      label: `${labelPrefix} Market Confidence`,
      currentPrice: "N/A",
      change24h: "No markets",
      bars: [],
    };
  } catch {
    // fallback below
  }

  return {
    label: `${category === "BTC" ? "BTC" : "QRL"} Market Confidence`,
    currentPrice: "N/A",
    change24h: "No markets",
    bars: [],
  };
}

/**
 * Get leaderboard from indexed on-chain events.
 * Supports time filters and ranking by volume or profit.
 */
export async function getLeaderboard(
  period: "day" | "week" | "month" | "all" = "all",
  type: "volume" | "profit" = "volume"
): Promise<LeaderboardEntry[]> {
  try {
    const { getLeaderboardFromDb } = await import("./database");
    const rows = getLeaderboardFromDb(period, type);

    return rows.map((row, idx) => ({
      rank: idx + 1,
      address: row.buyer,
      addressShort:
        row.buyer.substring(0, 6) + "..." + row.buyer.substring(row.buyer.length - 4),
      totalVolume: formatVolume(BigInt(row.total_volume)),
      profit: formatProfit(BigInt(row.profit)),
      trades: row.trade_count,
      markets: row.market_count,
    }));
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    return [];
  }
}

function formatProfit(wei: bigint): string {
  const absWei = wei < BigInt(0) ? -wei : wei;
  const sign = wei < BigInt(0) ? "-" : "+";
  const ethValue = Number(absWei) / 1e18;
  if (ethValue >= 1_000_000) return sign + (ethValue / 1_000_000).toFixed(1) + "M";
  if (ethValue >= 1_000) return sign + (ethValue / 1_000).toFixed(1) + "k";
  if (ethValue >= 1) return sign + ethValue.toFixed(2);
  return sign + ethValue.toFixed(4);
}

/**
 * Get portfolio positions for a specific wallet address.
 * Reads ERC1155 balances and calculates PnL from indexed cost basis.
 */
export async function getPortfolio(account: string): Promise<PortfolioPosition[]> {
  try {
    const p = getProvider();
    await p.getBlockNumber();

    const factory = new ethers.Contract(
      CONTRACTS.MarketFactory,
      MarketFactoryABI,
      p
    );
    const ct = new ethers.Contract(
      CONTRACTS.ConditionalToken,
      ConditionalTokenABI,
      p
    );

    const { getCostBasis, getSellProceeds } = await import("./database");
    const marketCount = Number(await factory.marketCount());
    const positions: PortfolioPosition[] = [];
    const MAX_OUTCOMES = 20;

    for (let i = 0; i < marketCount; i++) {
      try {
        const marketAddr = await factory.markets(i);
        const market = new ethers.Contract(marketAddr, PredictionMarketABI, p);
        const info = await market.getMarketInfo();

        const question: string = info[0];
        const status: bigint = info[2];
        const yesPrice: bigint = info[3];
        const noPrice: bigint = info[4];

        const outcomeCount = Number(await market.outcomeCount());

        for (let j = 0; j < outcomeCount; j++) {
          // New token ID scheme: marketId * MAX_OUTCOMES * 2 + outcomeIndex * 2
          const yesTokenId = i * MAX_OUTCOMES * 2 + j * 2;
          const noTokenId = i * MAX_OUTCOMES * 2 + j * 2 + 1;

          let oYesPrice = yesPrice;
          let oNoPrice = noPrice;
          if (j > 0) {
            try {
              const oInfo = await market.getOutcomeInfo(j);
              oYesPrice = oInfo[1];
              oNoPrice = oInfo[2];
            } catch { /* use defaults */ }
          }

          const yesBal: bigint = await ct.balanceOf(account, yesTokenId);
          const noBal: bigint = await ct.balanceOf(account, noTokenId);

          let outcomeLabel = "";
          try {
            outcomeLabel = await market.getOutcomeLabel(j);
          } catch { /* skip */ }

          const displayQuestion = outcomeCount > 2 && outcomeLabel
            ? `${question}: ${outcomeLabel}`
            : question;

          if (yesBal > BigInt(0)) {
            const shares = Number(ethers.formatEther(yesBal));
            const price = Number(ethers.formatEther(oYesPrice));
            const posValue = shares * price;
            const costWei = BigInt(getCostBasis(account, i, 1));
            const sellWei = BigInt(getSellProceeds(account, i, 1));
            const netCost = costWei - sellWei;
            const costEth = Number(netCost) / 1e18;
            const pnl = posValue - costEth;

            positions.push({
              marketId: i,
              question: displayQuestion,
              side: "YES",
              shares: shares.toFixed(4),
              currentPrice: Math.round(price * 100),
              marketResolved: Number(status) === 1,
              costBasis: costEth.toFixed(4),
              unrealizedPnL: pnl.toFixed(4),
            });
          }

          if (noBal > BigInt(0)) {
            const shares = Number(ethers.formatEther(noBal));
            const price = Number(ethers.formatEther(oNoPrice));
            const posValue = shares * price;
            const costWei = BigInt(getCostBasis(account, i, 0));
            const sellWei = BigInt(getSellProceeds(account, i, 0));
            const netCost = costWei - sellWei;
            const costEth = Number(netCost) / 1e18;
            const pnl = posValue - costEth;

            positions.push({
              marketId: i,
              question: displayQuestion,
              side: "NO",
              shares: shares.toFixed(4),
              currentPrice: Math.round(price * 100),
              marketResolved: Number(status) === 1,
              costBasis: costEth.toFixed(4),
              unrealizedPnL: pnl.toFixed(4),
            });
          }
        }
      } catch {
        // skip
      }
    }

    return positions;
  } catch (err) {
    console.error("Failed to fetch portfolio:", err);
    return [];
  }
}

/**
 * Get full profile data for an address: stats, trade history, portfolio history, current positions.
 */
export async function getProfileData(address: string): Promise<ProfileData> {
  const { getUserStats, getProfileTrades, getPortfolioHistory } = await import("./database");

  const stats = getUserStats(address);
  const rawTrades = getProfileTrades(address);
  const rawHistory = getPortfolioHistory(address);

  // Get market questions for trade history display
  const marketQuestions = new Map<number, string>();
  try {
    const p = getProvider();
    const factory = new ethers.Contract(CONTRACTS.MarketFactory, MarketFactoryABI, p);
    const marketCount = Number(await factory.marketCount());
    for (let i = 0; i < marketCount; i++) {
      try {
        const addr = await factory.markets(i);
        const market = new ethers.Contract(addr, PredictionMarketABI, p);
        const info = await market.getMarketInfo();
        marketQuestions.set(i, info[0] as string);
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  const trades: ProfileTrade[] = rawTrades.map((t) => ({
    type: t.type,
    txHash: t.tx_hash,
    marketIndex: t.market_index,
    question: marketQuestions.get(t.market_index) || `Market #${t.market_index}`,
    side: t.type === "claim" ? "—" : t.is_yes ? "YES" : "NO",
    amount: (Number(BigInt(t.amount)) / 1e18).toFixed(4),
    costOrPayout: (Number(BigInt(t.cost_or_payout)) / 1e18).toFixed(4),
    timestamp: t.timestamp,
  }));

  // Build cumulative portfolio value history from daily net flows
  let cumulative = 0;
  const portfolioHistory: PortfolioHistoryPoint[] = rawHistory.map((h) => {
    cumulative += Number(BigInt(h.netFlow)) / 1e18;
    return { date: h.day, value: cumulative };
  });

  const currentPositions = await getPortfolio(address);

  return {
    address,
    stats: {
      totalVolume: formatVolume(BigInt(stats.totalVolume)),
      profit: formatProfit(BigInt(stats.profit)),
      totalTrades: stats.totalTrades,
      marketsTraded: stats.marketsTraded,
      wins: stats.wins,
    },
    trades,
    portfolioHistory,
    currentPositions,
  };
}
