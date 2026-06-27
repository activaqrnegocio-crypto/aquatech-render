/**
 * https-proxy.js — Proxy HTTPS → HTTP para el servidor Next.js
 * 
 * Uso: 
 *   1. Inicia Next.js:     npm run start
 *   2. Inicia este proxy:  node https-proxy.js
 *   3. APK apunta a:       https://192.168.100.43:3443
 * 
 * El proxy recibe HTTPS y lo reenvía como HTTP a Next.js.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CERT_DIR = __dirname;
const HTTPS_PORT = 3443;
const NEXTJS_PORT = 3000;

const options = {
  key: fs.readFileSync(path.join(CERT_DIR, '192.168.100.43+2-key.pem')),
  cert: fs.readFileSync(path.join(CERT_DIR, '192.168.100.43+2.pem')),
};

const server = https.createServer(options, (req, res) => {
  const proxyReq = http.request(
    {
      hostname: 'localhost',
      port: NEXTJS_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `192.168.100.43:${HTTPS_PORT}` },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error(`[HTTPS Proxy] Error: ${err.message}`);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
});

server.listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log(`[HTTPS Proxy] Corriendo en https://192.168.100.43:${HTTPS_PORT}`);
  console.log(`[HTTPS Proxy] Redirige a → http://localhost:${NEXTJS_PORT}`);
});
