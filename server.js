const http = require('http');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const port = Number(process.env.DATABRICKS_APP_PORT || 8080);
const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, 'data');
const defaultDocumentId = 'default';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

async function ensureDirectories() {
  await fsp.mkdir(publicDir, { recursive: true });
  await fsp.mkdir(dataDir, { recursive: true });
}

function getDocumentPath(documentId) {
  const safeId = (documentId || defaultDocumentId).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(dataDir, `${safeId || defaultDocumentId}.json`);
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });

    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

async function serveFile(res, filePath) {
  try {
    const content = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      sendText(res, 404, 'Not found');
      return;
    }

    console.error('Static file error:', error);
    sendText(res, 500, 'Internal server error');
  }
}

async function handleApi(req, res, url) {
  const pathParts = url.pathname.split('/').filter(Boolean);
  const documentId = pathParts[2] || defaultDocumentId;

  if (req.method === 'GET' && url.pathname.startsWith('/api/documents/')) {
    try {
      const filePath = getDocumentPath(documentId);
      const content = await fsp.readFile(filePath, 'utf8');
      sendJson(res, 200, JSON.parse(content));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        sendJson(res, 404, { error: 'Document not found', documentId });
        return true;
      }

      console.error('Read document error:', error);
      sendJson(res, 500, { error: 'Unable to read document' });
      return true;
    }
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/documents/')) {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody || '{}');
      const payload = {
        documentId,
        updatedAt: new Date().toISOString(),
        content: parsed.content || parsed,
      };

      await fsp.writeFile(getDocumentPath(documentId), JSON.stringify(payload, null, 2), 'utf8');
      sendJson(res, 200, { ok: true, documentId, updatedAt: payload.updatedAt });
      return true;
    } catch (error) {
      console.error('Write document error:', error);
      sendJson(res, 400, { error: 'Invalid document payload' });
      return true;
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'reporting-distribution-app', runtime: 'node' });
    return true;
  }

  return false;
}

async function requestListener(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (await handleApi(req, res, url)) {
    return;
  }

  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const normalizedPath = path.normalize(requestedPath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  try {
    const stats = await fsp.stat(filePath);
    if (stats.isDirectory()) {
      await serveFile(res, path.join(filePath, 'index.html'));
      return;
    }

    await serveFile(res, filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await serveFile(res, path.join(publicDir, 'index.html'));
      return;
    }

    console.error('Request error:', error);
    sendText(res, 500, 'Internal server error');
  }
}

async function bootstrap() {
  await ensureDirectories();

  const server = http.createServer((req, res) => {
    requestListener(req, res).catch(error => {
      console.error('Unhandled request error:', error);
      sendJson(res, 500, { error: 'Unhandled server error' });
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Reporting distribution app listening on port ${port}`);
  });
}

bootstrap().catch(error => {
  console.error('Startup error:', error);
  process.exit(1);
});
