// Node.js server wrapper for Render / any Node host
// Wraps the Worker fetch() handler from dist/server/index.js
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.resolve(__dirname, 'dist/server/index.js');

const {default: worker} = await import(pathToFileURL(workerPath));

// Server-only env for the verifier key (Render env var)
const env = {
  MEADOW_REWARD_SIGNER_KEY: process.env.MEADOW_REWARD_SIGNER_KEY || '',
  MEADOW_RPC_URL: process.env.MEADOW_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
};

const PORT = Number(process.env.PORT || 4389);
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const url = `http://${req.headers.host}${req.url}`;

    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      ...(!['GET', 'HEAD'].includes(req.method) ? {body} : {}),
    });

    const result = await worker.fetch(request, env);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, {'content-type': 'text/plain'});
    res.end('Server error: ' + (err.message || 'unknown'));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MeadowFarm listening on http://${HOST}:${PORT}/`);
  console.log(`Verifier configured: ${env.MEADOW_REWARD_SIGNER_KEY ? 'YES' : 'NO (rewards disabled)'}`);
  console.log(`RPC: ${env.MEADOW_RPC_URL}`);
});
