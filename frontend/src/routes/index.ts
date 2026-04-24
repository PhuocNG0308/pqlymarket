import { Router, Request, Response } from "express";
import { CONTRACTS, CHAIN_ID, RPC_URL } from "../config/contracts";
import {
  getMarkets,
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
    rpcUrl: "/api/rpc", // ✅ Same-origin proxy bypasses CORS & Mixed Content
    chainId: CHAIN_ID,
    contracts: CONTRACTS,
  };
}

// Home page
pageRouter.get("/", async (req: Request, res: Response) => {
  const category = (req.query.category as string) || "QRL";

  try {
    const [markets, featured, priceTrend, sentiment, volumeChart] =
      await Promise.all([
        getMarkets(category),
        getFeaturedMarket(category),
        getQRLPriceTrend(category),
        getSentiment(),
        getVolumeChart(),
      ]);

    // Separate binary (2 outcomes) from multi-outcome markets
    const binaryMarkets = markets.filter((m) => m.outcomeCount <= 2);
    const multiOutcomeMarkets = markets.filter((m) => m.outcomeCount > 2);

    res.render("pages/index", {
      title: "PQlymarket | Crypto Prediction Market",
      ...getBaseLocals("markets", category),
      markets: binaryMarkets,
      multiOutcomeMarkets,
      featured,
      priceTrend,
      sentiment,
      volumeChart,
      noMarkets: binaryMarkets.length === 0 && multiOutcomeMarkets.length === 0 && !featured,
    });
  } catch (err) {
    console.error("[Home] Failed to load markets:", (err as Error).message);
    res.render("pages/index", {
      title: "PQlymarket | Crypto Prediction Market",
      ...getBaseLocals("markets", category),
      markets: [],
      multiOutcomeMarkets: [],
      featured: null,
      priceTrend: { label: "QRL Price (7d)", bars: Array(7).fill(50) },
      sentiment: { bullish: 50, bearish: 50 },
      volumeChart: [],
      noMarkets: true,
    });
  }
});

// Market detail (supports binary and multi-outcome)
pageRouter.get("/market/:id", async (req: Request, res: Response) => {
  const marketId = parseInt(req.params.id as string, 10);
  const allMarkets = await getMarkets();
  const market = allMarkets.find((m) => m.id === marketId) || allMarkets[0];

  if (!market) {
    res.render("pages/index", {
      title: "PQlymarket | Market Not Found",
      ...getBaseLocals("markets"),
      markets: [],
      multiOutcomeMarkets: [],
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
