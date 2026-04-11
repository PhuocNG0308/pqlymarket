export interface ContractAddresses {
  ConditionalToken: string;
  Oracle: string;
  PqlToken?: string;
  GovernanceOracle?: string;
  MarketFactory: string;
  Faucet?: string;
  BondingCurve?: string;
  LiquidityPool?: string;
}

export interface MarketData {
  id: number;
  question: string;
  category: "BTC" | "QRL";
  yesPrice: number;
  noPrice: number;
  volume: string;
  traders: string;
  endDate: string;
  resolved: boolean;
  outcome?: boolean;
  metadata?: string;
  icon?: string;
  liquidity?: string;
  address?: string;
  groupId?: number;           // if part of a group, the group ID
  outcomeLabel?: string;      // label within the group, e.g. "↑ $200"
}

export interface MarketGroupData {
  groupId: number;
  title: string;
  category: "BTC" | "QRL";
  endDate: string;
  creator: string;
  outcomes: MarketGroupOutcome[];
  totalVolume: string;
  totalTraders: string;
  icon?: string;
}

export interface MarketGroupOutcome {
  marketId: number;
  label: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  resolved: boolean;
  address?: string;
}

export interface FeaturedMarket extends MarketData {
  totalBets: string;
  chanceOfYes: number;
}

export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
}

export interface PriceTrend {
  label: string;
  currentPrice: string;
  change24h: string;
  bars: number[];
}

export interface SentimentData {
  bullishPercent: number;
  signal: string;
  activePositions: string;
  openInterest: string;
}

export interface VolumeChart {
  labels: string[];
  data: number[];
  monthlyGrowth: string;
}

export interface PageLocals {
  title: string;
  activePage: string;
  activeCategory: string;
  rpcUrl: string;
  chainId: number;
  contracts: ContractAddresses;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  addressShort: string;
  totalVolume: string;
  profit: string;
  trades: number;
  markets: number;
}

export interface PortfolioPosition {
  marketId: number;
  question: string;
  side: "YES" | "NO";
  shares: string;
  currentPrice: number;
  marketResolved: boolean;
  costBasis: string;
  unrealizedPnL: string;
}

export interface ProfileData {
  address: string;
  stats: ProfileStats;
  trades: ProfileTrade[];
  portfolioHistory: PortfolioHistoryPoint[];
  currentPositions: PortfolioPosition[];
}

export interface ProfileStats {
  totalVolume: string;
  profit: string;
  totalTrades: number;
  marketsTraded: number;
  wins: number;
}

export interface ProfileTrade {
  type: "buy" | "sell" | "claim";
  txHash: string;
  marketIndex: number;
  question: string;
  side: string;
  amount: string;
  costOrPayout: string;
  timestamp: number;
}

export interface PortfolioHistoryPoint {
  date: string;
  value: number;
}
