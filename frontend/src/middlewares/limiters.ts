import rateLimit from "express-rate-limit";

// Global Rate Limiter (anti-bot/DDoS)
export const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 120,                   // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Strict rate limiter for sensitive endpoints (faucet, admin)
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Try again in 15 minutes." },
});

// API rate limiter (moderate)
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 60,                    // 60 API calls per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "API rate limit exceeded." },
});
