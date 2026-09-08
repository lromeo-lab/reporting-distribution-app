const http = require('http');
const https = require('https');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const port = Number(process.env.DATABRICKS_APP_PORT || 8080);
const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, 'data');
const defaultDocumentId = 'default';

// --------------- Databricks Auth ---------------
function resolveDatabricksHost() {
  let host = process.env.DATABRICKS_HOST || '';
  if (!host) {
    const hostname = process.env.DATABRICKS_SERVER_HOSTNAME || '';
    if (hostname) host = hostname;
  }
  if (host && !host.startsWith('http')) {
    host = `https://${host}`;
  }
  return host.replace(/\/+$/, '');
}

const databricksHost = resolveDatabricksHost();
const databricksClientId = process.env.DATABRICKS_CLIENT_ID || '';
const databricksClientSecret = process.env.DATABRICKS_CLIENT_SECRET || '';
const databricksDirectToken = process.env.DATABRICKS_TOKEN || '';

console.log('[auth] DATABRICKS_HOST env:', process.env.DATABRICKS_HOST ? 'set' : 'NOT SET');
console.log('[auth] DATABRICKS_SERVER_HOSTNAME env:', process.env.DATABRICKS_SERVER_HOSTNAME ? 'set' : 'NOT SET');
console.log('[auth] Resolved host:', databricksHost || '(empty)');
console.log('[auth] CLIENT_ID:', databricksClientId ? 'set' : 'NOT SET');
console.log('[auth] CLIENT_SECRET:', databricksClientSecret ? 'set' : 'NOT SET');
console.log('[auth] DATABRICKS_TOKEN:', databricksDirectToken ? 'set' : 'NOT SET');

let cachedToken = null;
let tokenExpiresAt = 0;

function extractWorkspaceId(host) {
  try {
    const hostname = new URL(host).hostname;
    const first = hostname.split('.')[0];
    if (/^\d+$/.test(first)) return first;
  } catch (_) { /* ignore */ }
  return '';
}

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  // Priority 1: direct token from env
  if (databricksDirectToken) {
    return databricksDirectToken;
  }

  // Priority 2: cached OAuth token
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  // Priority 3: OAuth M2M flow
  if (!databricksHost) {
    throw new Error('No DATABRICKS_HOST or DATABRICKS_SERVER_HOSTNAME env var set');
  }
  if (!databricksClientId || !databricksClientSecret) {
    throw new Error('No DATABRICKS_CLIENT_ID / DATABRICKS_CLIENT_SECRET env vars (and no DATABRICKS_TOKEN)');
  }

  const tokenUrl = `${databricksHost}/oidc/v1/token`;
  console.log('[auth] Requesting OAuth token from:', tokenUrl);
  const payload = `grant_type=client_credentials&client_id=${encodeURIComponent(databricksClientId)}&client_secret=${encodeURIComponent(databricksClientSecret)}&scope=all-apis`;
  const resp = await httpsRequest(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, payload);
  console.log('[auth] Token response status:', resp.statusCode);
  if (resp.statusCode !== 200) {
    throw new Error(`OAuth token error ${resp.statusCode}: ${resp.body.slice(0, 300)}`);
  }
  const parsed = JSON.parse(resp.body);
  cachedToken = parsed.access_token;
  tokenExpiresAt = Date.now() + (parsed.expires_in || 3600) * 1000;
  console.log('[auth] OAuth token acquired, expires in', parsed.expires_in, 's');
  return cachedToken;
}

async function databricksApiGet(apiPath) {
  const token = await getAccessToken();
  const url = `${databricksHost}${apiPath}`;
  console.log('[api] GET', url);
  const resp = await httpsRequest(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('[api] Response status:', resp.statusCode);
  if (resp.statusCode !== 200) {
    throw new Error(`Databricks API ${resp.statusCode}: ${resp.body.slice(0, 500)}`);
  }
  return JSON.parse(resp.body);
}

function parseWidgetsFromDashboard(dashboardId, raw) {
  const config = typeof raw.serialized_dashboard === 'string'
    ? JSON.parse(raw.serialized_dashboard)
    : raw.serialized_dashboard || {};
  const workspaceId = extractWorkspaceId(databricksHost);
  const pages = (config.pages || []).map(page => {
    const widgets = (page.layout || []).map(item => {
      const w = item.widget || {};
      const spec = w.spec || {};
      const frame = spec.frame || {};
      const title = frame.title?.value || w.name || 'Untitled';
      const widgetType = spec.widgetType || 'unknown';
      const embedUrl = `${databricksHost}/embed/dashboardsv3/${dashboardId}?o=${workspaceId}&fullscreenWidget=${page.name}~${w.name}`;
      return { name: w.name, title, widgetType, embedUrl, position: item.position };
    }).filter(w => w.name);
    return { name: page.name, displayName: page.displayName || page.name, widgets };
  });
  return { dashboardId, displayName: raw.display_name, pages };
}



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
      'Cache-Control': 'no-cache',
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

  // --------------- Document listing ---------------
  if (req.method === 'GET' && url.pathname === '/api/documents') {
    try {
      const files = await fsp.readdir(dataDir).catch(() => []);
      const docs = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const id = file.replace(/\.json$/, '');
        const filePath = path.join(dataDir, file);
        const stat = await fsp.stat(filePath);
        let title = id;
        try {
          const raw = JSON.parse(await fsp.readFile(filePath, 'utf8'));
          const content = raw.content || raw;
          const firstHeading = (content.content || []).find(n => n.type === 'heading');
          if (firstHeading?.content?.[0]?.text) title = firstHeading.content[0].text;
        } catch (_) { /* ignore */ }
        docs.push({ id, title, updatedAt: stat.mtime.toISOString() });
      }
      docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      sendJson(res, 200, { documents: docs });
      return true;
    } catch (err) {
      sendJson(res, 500, { error: err.message });
      return true;
    }
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/documents/')) {
    try {
      const filePath = getDocumentPath(documentId);
      await fsp.unlink(filePath);
      sendJson(res, 200, { deleted: true });
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        sendJson(res, 404, { error: 'Not found' });
      } else {
        sendJson(res, 500, { error: err.message });
      }
      return true;
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'reporting-distribution-app', runtime: 'node' });
    return true;
  }

  // --------------- Dashboard proxy ---------------
  if (req.method === 'GET' && url.pathname === '/api/proxy/dashboards') {
    try {
      const pageSize = url.searchParams.get('page_size') || '50';
      const pageToken = url.searchParams.get('page_token') || '';
      let apiPath = `/api/2.0/lakeview/dashboards?page_size=${pageSize}`;
      if (pageToken) apiPath += `&page_token=${encodeURIComponent(pageToken)}`;
      const data = await databricksApiGet(apiPath);
      const dashboards = (data.dashboards || []).filter(d => d.lifecycle_state === 'ACTIVE').map(d => ({
        id: d.dashboard_id,
        name: d.display_name,
        path: d.parent_path,
        updatedAt: d.update_time,
      }));
      sendJson(res, 200, { dashboards, nextPageToken: data.next_page_token || null });
      return true;
    } catch (err) {
      console.error('Dashboard list error:', err.message);
      sendJson(res, 502, { error: err.message });
      return true;
    }
  }

  if (req.method === 'GET' && url.pathname.match(/^\/api\/proxy\/dashboards\/[^/]+\/widgets$/)) {
    try {
      const dashId = url.pathname.split('/')[4];
      const raw = await databricksApiGet(`/api/2.0/lakeview/dashboards/${dashId}`);
      const result = parseWidgetsFromDashboard(dashId, raw);
      sendJson(res, 200, result);
      return true;
    } catch (err) {
      console.error('Widget list error:', err.message);
      sendJson(res, 502, { error: err.message });
      return true;
    }
  }





  if (req.method === 'GET' && url.pathname === '/api/proxy/config') {
    sendJson(res, 200, {
      host: databricksHost,
      workspaceId: extractWorkspaceId(databricksHost),
      hasClientCredentials: !!(databricksClientId && databricksClientSecret),
      hasDirectToken: !!databricksDirectToken,
      envDiag: {
        DATABRICKS_HOST: process.env.DATABRICKS_HOST ? 'set' : 'NOT SET',
        DATABRICKS_SERVER_HOSTNAME: process.env.DATABRICKS_SERVER_HOSTNAME ? 'set' : 'NOT SET',
        DATABRICKS_CLIENT_ID: databricksClientId ? 'set' : 'NOT SET',
        DATABRICKS_CLIENT_SECRET: databricksClientSecret ? 'set' : 'NOT SET',
        DATABRICKS_TOKEN: databricksDirectToken ? 'set' : 'NOT SET',
      },
    });
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
