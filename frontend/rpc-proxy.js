const http = require('http');

const PORT = 8546;
const TARGET_HOST = '209.250.255.226';
const TARGET_PORT = 8545;

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        });
        res.end();
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
        headers['access-control-allow-origin'] = '*';
        headers['access-control-allow-methods'] = 'POST, GET, OPTIONS';
        headers['access-control-allow-headers'] = 'Content-Type, Authorization';
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
