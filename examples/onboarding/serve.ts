import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Serve only generated public files, bound to this computer.
const root = resolve('site-dist');
const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const file = path === '/' ? 'index.html'
    : /^\/[a-z0-9-]+\/$/.test(path) ? `${path.slice(1)}index.html`
    : ['/robots.txt', '/sitemap.xml'].includes(path) ? path.slice(1) : null;
  if (!file) { response.writeHead(404).end('Not found'); return; }
  try {
    const content = await readFile(resolve(root, file));
    const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.xml') ? 'application/xml' : 'text/plain';
    response.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' }).end(content);
  } catch { response.writeHead(404).end('Run npm run onboarding:site first.'); }
});
server.listen(8080, '127.0.0.1', () => console.log('Public fixture preview: http://127.0.0.1:8080 (Ctrl+C to stop)'));
server.on('error', () => { console.error('Could not start preview. Port 8080 may already be in use.'); process.exitCode = 1; });
