import { createServer } from 'node:http';
import { analyzeEmail } from './analyze.js';

/** Local integration adapter. Not a production authenticated API. */
export function createAnalysisServer(providers) {
  let busy = false;
  return createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(JSON.stringify(body));
    };
    const port = req.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!hosts.includes(req.headers.host) || (req.headers.origin && !hosts.map(h=>`http://${h}`).includes(req.headers.origin)))
      return send(403, { error: { code: 'ORIGIN_REJECTED' } });
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, scope: 'local-only' });
    if (req.url !== '/api/analyze') return send(404, { error: { code: 'NOT_FOUND' } });
    if (req.method !== 'POST') return send(405, { error: { code: 'METHOD_NOT_ALLOWED' } });
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return send(415, { error: { code: 'JSON_REQUIRED' } });
    if (busy) return send(429, { error: { code: 'BUSY', message: 'One analysis is already running.' } });
    busy = true;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 100000) { send(413, { error: { code: 'BODY_TOO_LARGE' } }); return; }
        chunks.push(chunk);
      }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return send(400, { error: { code: 'INVALID_JSON' } }); }
      const result = await analyzeEmail(input, providers);
      send(result.status, result.body);
    } catch { if (!res.headersSent) send(500, { error: { code: 'ANALYSIS_FAILED', message: 'Analysis failed. No record or email changed.' } }); }
    finally { busy = false; }
  });
}
