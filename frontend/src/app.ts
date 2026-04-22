import express from "express";
import expressLayouts from "express-ejs-layouts";
import helmet from "helmet";
import path from "path";
import { pageRouter } from "./routes/index";
import { apiRouter } from "./routes/api";
import { globalLimiter, apiLimiter } from "./middlewares/limiters";

export const app = express();

// Trust proxy for Cloudflare tunnels
app.set("trust proxy", 1);

// ═══════════════════════════════════════════
// Security Headers (helmet)
// ═══════════════════════════════════════════
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",           // EJS inline scripts
          "https://cdn.jsdelivr.net",  // Chart.js, ethers
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",           // Tailwind inline styles
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://fonts.googleapis.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://qrlwallet.com/api/qrl-rpc/testnet",
          "https://qrlwallet.com/api/qrl-rpc/testnet",
          "http://localhost:8546",
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,   // Allow CDN scripts
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// ═══════════════════════════════════════════
// Global Rate Limiter (anti-bot/DDoS)
// ═══════════════════════════════════════════
app.use(globalLimiter);

// ═══════════════════════════════════════════
// robots.txt (anti-crawler)
// ═══════════════════════════════════════════
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    "User-agent: *\nDisallow: /api/\nDisallow: /admin/\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ChatGPT-User\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: anthropic-ai\nDisallow: /\n"
  );
});

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(expressLayouts);
app.set("layout", "layout");

// Static files with cache control
app.use(express.static(path.join(__dirname, "../public"), {
  maxAge: "1d",
  etag: true,
}));

// Body parsing with size limits (anti-payload attacks)
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ═══════════════════════════════════════════
// Disable server fingerprinting
// ═══════════════════════════════════════════
app.disable("x-powered-by");

// Routes
app.use("/", pageRouter);
app.use("/api", apiLimiter, apiRouter);
