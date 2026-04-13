const http = require('http');

const PORT = 8546;
const TARGET_HOST = '209.250.255.226';
const TARGET_PORT = 8545;

// Allowed origins (prevent open relay abuse)
const ALLOWED_ORIGINS = [
    'https://pqlymarket.com',
    'http://localhost:3000',
    'http://localhost:8546',
    'http://127.0.0.1:3000',
];

// Rate limiting: simple in-memory token bucket per IP
const ipRequests = new Map();
const MAX_REQUESTS_PER_MINUTE = 120;

function isRateLimited(ip) {
    const now = Date.now();
    const entry = ipRequests.get(ip);
    if (!entry || now - entry.windowStart > 60000) {
        ipRequests.set(ip, { count: 1, windowStart: now });
        return false;
    }
    entry.count++;
    if (entry.count > MAX_REQUESTS_PER_MINUTE) return true;
    return false;
}

// Clean up rate limit map every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of ipRequests) {
        if (now - entry.windowStart > 120000) ipRequests.delete(ip);
    }
}, 300000);

const server = http.createServer((req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const origin = req.headers.origin || '';

    // Rate limit check
    if (isRateLimited(clientIp)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many requests' }));
        return;
    }

    // Determine CORS origin (restrict to allowed list, fallback to * for wallet extensions)
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (origin ? origin : '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        });
        res.end();
        return;
    }

    // Only allow POST (JSON-RPC is always POST)
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Only POST accepted.' }));
        return;
    }

    // 2. Route configuration with explicit Host header rewrite
    const options = {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: TARGET_HOST // THIS FIXES THE 403 INVALID HOST SPECIFIED!
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        // Merge CORS headers into the proxied response
        const headers = { ...proxyRes.headers };
        headers['access-control-allow-origin'] = corsOrigin;
        headers['access-control-allow-methods'] = 'POST, OPTIONS';
        headers['access-control-allow-headers'] = 'Content-Type';
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res, { end: true });
    });

    req.pipe(proxyReq, { end: true });

    proxyReq.on('error', (err) => {
        console.error('[Proxy Error]', err.message);
        res.writeHead(500);
        res.end('Proxy Error');
    });
});

server.listen(PORT, () => {
    console.log(`[Local Proxy] Running on port ${PORT}. Forwarding all traffic to http://${TARGET_HOST}:${TARGET_PORT}`);
});
