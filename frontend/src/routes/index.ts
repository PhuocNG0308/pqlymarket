import { Router, Request, Response } from "express";
import { CONTRACTS, CHAIN_ID, RPC_URL } from "../config/contracts";
import {
  getMarkets,
  getMarketGroups,
  getFeaturedMarket,
  getQRLPriceTrend,
  getSentiment,
  getVolumeChart,
} from "../services/blockchain";
import { CategoryInfo } from "../types";

export const pageRouter = Router();

const categories: CategoryInfo[] = [
  { id: "QRL", name: "QRL", icon: "shield" },
  { id: "BTC", name: "BTC", icon: "currency_bitcoin" },
];

// Shared locals for all pages
function getBaseLocals(activePage: string, activeCategory: string = "QRL") {
  return {
    activePage,
    activeCategory,
    categories,
    rpcUrl: RPC_URL,
    chainId: CHAIN_ID,
    contracts: CONTRACTS,
  };
}

// Home page
pageRouter.get("/", async (req: Request, res: Response) => {
  const category = (req.query.category as string) || "QRL";

  const [markets, groups, featured, priceTrend, sentiment, volumeChart] =
    await Promise.all([
      getMarkets(category),
      getMarketGroups(category),
      getFeaturedMarket(category),
      getQRLPriceTrend(category),
      getSentiment(),
      getVolumeChart(),
    ]);

  // Standalone markets (not in any group)
  const standaloneMarkets = markets.filter((m) => m.groupId === undefined);

  res.render("pages/index", {
    title: "PQlymarket | Crypto Prediction Market",
    ...getBaseLocals("markets", category),
    markets: standaloneMarkets,
    groups,
    featured,
    priceTrend,
    sentiment,
    volumeChart,
    noMarkets: standaloneMarkets.length === 0 && groups.length === 0 && !featured,
  });
});

// Market detail (standalone binary market)
pageRouter.get("/market/:id", async (req: Request, res: Response) => {
  const marketId = parseInt(req.params.id as string, 10);
  const allMarkets = await getMarkets();
  const market = allMarkets.find((m) => m.id === marketId) || allMarkets[0];

  if (!market) {
    res.render("pages/index", {
      title: "PQlymarket | Market Not Found",
      ...getBaseLocals("markets"),
      markets: [],
      groups: [],
      featured: null,
      priceTrend: await getQRLPriceTrend(),
      sentiment: await getSentiment(),
      volumeChart: await getVolumeChart(),
      noMarkets: true,
    });
    return;
  }

  res.render("pages/market", {
    title: `${market.question} | PQlymarket`,
    ...getBaseLocals("markets", market.category),
    market,
  });
});

// Group detail (Polymarket-style multi-outcome)
pageRouter.get("/group/:id", async (req: Request, res: Response) => {
  const groupId = parseInt(req.params.id as string, 10);
  const allGroups = await getMarketGroups();
  const group = allGroups.find((g) => g.groupId === groupId);

  if (!group) {
    res.redirect("/");
    return;
  }

  res.render("pages/group", {
    title: `${group.title} | PQlymarket`,
    ...getBaseLocals("markets", group.category),
    group,
  });
});

// Portfolio — data loaded client-side via wallet + API
pageRouter.get("/portfolio", (_req: Request, res: Response) => {
  res.render("pages/portfolio", {
    title: "Portfolio | PQlymarket",
    ...getBaseLocals("portfolio"),
  });
});

// Leaderboard — data loaded client-side via API
pageRouter.get("/leaderboard", (_req: Request, res: Response) => {
  res.render("pages/leaderboard", {
    title: "Leaderboard | PQlymarket",
    ...getBaseLocals("leaderboard"),
  });
});

// Profile page — data loaded client-side via API
pageRouter.get("/profile/:address", (_req: Request, res: Response) => {
  const addr = _req.params.address as string;
  // Validate address format (0x or Q prefix + hex)
  if (!/^(0x|Q)[0-9a-fA-F]{40}$/.test(addr)) {
    res.redirect("/leaderboard");
    return;
  }
  res.render("pages/profile", {
    title: "Trader Profile | PQlymarket",
    ...getBaseLocals("leaderboard"),
    profileAddress: addr,
  });
});

// Create Market page (authorized wallet required client-side)
pageRouter.get("/create", (_req: Request, res: Response) => {
  res.render("pages/create", {
    title: "Create Market | PQlymarket",
    ...getBaseLocals("create"),
  });
});

// Governance page — oracle voting UI
pageRouter.get("/governance", async (req: Request, res: Response) => {
  const markets = await getMarkets();
  res.render("pages/governance", {
    title: "Governance | PQlymarket",
    ...getBaseLocals("governance"),
    markets,
  });
});

// PQL Token — bonding curve buy/sell page
pageRouter.get("/pql", (_req: Request, res: Response) => {
  res.render("pages/pql", {
    title: "PQL Token | PQlymarket",
    ...getBaseLocals("pql"),
  });
});
