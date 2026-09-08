const http = require('http');
const https = require('https');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');
let pg;
try {
  pg = require('pg');
} catch (e) {
  console.error('[db] Failed to load pg module:', e.message);
  pg = null;
}

const port = Number(process.env.DATABRICKS_APP_PORT || 8080);
const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const defaultDocumentId = 'default';

// --------------- Lakebase (Postgres) ---------------
// PG* env vars are auto-injected by Databricks Apps when Lakebase resource is configured
// Lakebase uses OAuth JWT tokens for auth — we manage the pool lifecycle
let pool = null;
let poolTokenExpiry = 0;

async function getPool() {
  if (!pg) return null;
  const now = Date.now();
  // Reuse pool if token is still valid (refresh 2 min before expiry)
  if (pool && now < poolTokenExpiry - 120_000) return pool;

  console.log('[db] Refreshing Lakebase connection with fresh OAuth token...');
  try {
    const token = await getAccessToken();
    // End old pool gracefully
    if (pool) { pool.end().catch(() => {}); }
    pool = new pg.Pool({
      password: token,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
    poolTokenExpiry = now + 3500_000; // ~58 minutes
    return pool;
  } catch (err) {
    console.error('[db] Failed to create pool:', err.message);
    return null;
  }
}

let dbInitialized = false;

async function ensureSchema() {
  if (dbInitialized) return;
  const db = await getPool();
  if (!db) return;
  try {
    // Check if documents table exists
    const { rows } = await db.query(
      "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') AS ok"
    );
    if (!rows[0].ok) {
      console.log('[db] Creating documents table (lazy init)...');
      await db.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT 'Untitled',
          content JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      console.log('[db] Table created. Inserting seed document...');
      const seedContent = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Summer Campaign — Operational Report' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'This report analyses the Sonae MC summer beverages promotion across Continente stores (Jul 7 — Sep 7, 2026). The campaign targeted key beverage SKUs with promotional pricing and featured placement.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Revenue Collapse by Segment' }] },
          { type: 'paragraph', content: [
            { type: 'text', text: 'Promo Store + Promo SKU revenue collapsed from ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '€15K to €3K/store' },
            { type: 'text', text: ' between weeks 33–37, while control segments held steady. This strongly suggests a ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'stockout-driven revenue loss' },
            { type: 'text', text: ' rather than a demand decline.' },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Revenue vs OOS Rate' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'The correlation between out-of-stock rate spikes and revenue drops is clearly visible from week 34 onwards. The OOS rate peaks at ~70% in week 36, directly coinciding with the steepest revenue decline.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Findings' }] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The promotion was effective in driving initial demand, but supply chain execution failed to keep pace — resulting in widespread stockouts that erased the campaign gains by week 37.' }] }] },
          { type: 'paragraph', content: [
            { type: 'text', text: 'Estimated revenue at risk: ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '€2.4M' },
            { type: 'text', text: ' across affected stores.' },
          ]},
        ],
      };
      await db.query(
        'INSERT INTO documents (id, title, content) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        ['summer-campaign-report', 'Summer Campaign Report', JSON.stringify(seedContent)]
      );
      console.log('[db] Seed document inserted');
    }
    dbInitialized = true;
    console.log('[db] Schema verified');
  } catch (err) {
    console.error('[db] Lazy init error:', err.message);
    // Don't set dbInitialized — will retry on next request
  }
}

async function initDatabase() {
  const db = await getPool();
  if (!db) throw new Error('No database pool available');
  console.log('[db] Connecting to Lakebase...');
  console.log('[db] PGHOST:', process.env.PGHOST || '(not set)');
  console.log('[db] PGDATABASE:', process.env.PGDATABASE || '(not set)');
  const client = await db.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('[db] Schema ready');

    // Seed: insert a sample document if table is empty
    const { rows } = await client.query('SELECT COUNT(*) AS cnt FROM documents');
    if (parseInt(rows[0].cnt) === 0) {
      console.log('[db] Inserting seed document...');
      const seedContent = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Summer Campaign — Operational Report' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'This report analyses the Sonae MC summer beverages promotion across Continente stores (Jul 7 — Sep 7, 2026). The campaign targeted key beverage SKUs with promotional pricing and featured placement.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Revenue Collapse by Segment' }] },
          { type: 'paragraph', content: [
            { type: 'text', text: 'Promo Store + Promo SKU revenue collapsed from ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '€15K to €3K/store' },
            { type: 'text', text: ' between weeks 33–37, while control segments held steady. This strongly suggests a ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'stockout-driven revenue loss' },
            { type: 'text', text: ' rather than a demand decline.' },
          ]},
          { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'italic' }], text: '👇 Drag the "Stockout Collapse" chart PNG below this paragraph.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Revenue vs OOS Rate' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'The correlation between out-of-stock rate spikes and revenue drops is clearly visible from week 34 onwards. The OOS rate peaks at ~70% in week 36, directly coinciding with the steepest revenue decline.' }] },
          { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'italic' }], text: '👇 Drag the "Revenue vs OOS Rate" chart PNG below this paragraph.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Findings' }] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The promotion was effective in driving initial demand, but supply chain execution failed to keep pace — resulting in widespread stockouts that erased the campaign gains by week 37.' }] }] },
          { type: 'paragraph', content: [
            { type: 'text', text: 'Estimated revenue at risk: ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '€2.4M' },
            { type: 'text', text: ' across affected stores.' },
          ]},
        ],
      };
      await client.query(
        'INSERT INTO documents (id, title, content) VALUES ($1, $2, $3)',
        ['summer-campaign-report', 'Summer Campaign Report', JSON.stringify(seedContent)]
      );
      console.log('[db] Seed document created');
    }
  } finally {
    client.release();
  }
}

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
  try {
    if (pg) await initDatabase();
    else console.warn('[db] Skipping database init (pg module not available)');
  } catch (err) {
    console.error('[db] Database init failed:', err.message);
    console.error('[db] App will run without persistence — documents will not be saved');
  }
}


async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 10_000_000) {
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
  // Lazy init: ensure DB schema exists on first API call
  if (!dbInitialized && url.pathname.startsWith('/api/documents')) await ensureSchema();

  const pathParts = url.pathname.split('/').filter(Boolean);
  const documentId = pathParts[2] || defaultDocumentId;

  // GET single document
  if (req.method === 'GET' && url.pathname.startsWith('/api/documents/') && !url.pathname.endsWith('/rename')) {
    try {
      const db = await getPool();
      if (!db) { sendJson(res, 503, { error: 'Database not available' }); return true; }
      const { rows } = await db.query('SELECT id, title, content, updated_at FROM documents WHERE id = $1', [documentId]);
      if (rows.length === 0) { sendJson(res, 404, { error: 'Document not found', documentId }); return true; }
      const doc = rows[0];
      sendJson(res, 200, { documentId: doc.id, title: doc.title, content: doc.content, updatedAt: doc.updated_at });
      return true;
    } catch (err) {
      console.error('Read document error:', err.message);
      sendJson(res, 500, { error: 'Read failed: ' + err.message });
      return true;
    }
  }

  // Rename document
  if (req.method === 'POST' && url.pathname.endsWith('/rename') && url.pathname.startsWith('/api/documents/')) {
    try {
      const docId = url.pathname.split('/')[3];
      const body = await readRequestBody(req);
      const parsed = JSON.parse(body);
      const db = await getPool();
      if (!db) { sendJson(res, 503, { error: 'Database not available' }); return true; }
      const { rows } = await db.query(
        'UPDATE documents SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING title',
        [parsed.title, docId]
      );
      if (rows.length === 0) { sendJson(res, 404, { error: 'Not found' }); return true; }
      sendJson(res, 200, { ok: true, title: rows[0].title });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // Save document (upsert)
  if (req.method === 'POST' && url.pathname.startsWith('/api/documents/')) {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody || '{}');
      const content = parsed.content || parsed;
      // Extract title from first heading
      let title = documentId;
      const firstH = (content.content || []).find(n => n.type === 'heading');
      if (firstH?.content?.[0]?.text) title = firstH.content[0].text;

      const db = await getPool();
      if (!db) { sendJson(res, 503, { error: 'Database not available' }); return true; }
      await db.query(`
        INSERT INTO documents (id, title, content, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO UPDATE SET content = $3, title = $2, updated_at = NOW()
      `, [documentId, title, JSON.stringify(content)]);
      sendJson(res, 200, { ok: true, documentId, updatedAt: new Date().toISOString() });
      return true;
    } catch (err) {
      console.error('Write document error:', err.message, err.stack);
      sendJson(res, 500, { error: 'Save failed: ' + err.message });
      return true;
    }
  }

  // List documents
  if (req.method === 'GET' && url.pathname === '/api/documents') {
    try {
      const db = await getPool();
      if (!db) { sendJson(res, 503, { error: 'Database not available' }); return true; }
      const { rows } = await db.query('SELECT id, title, updated_at FROM documents ORDER BY updated_at DESC');
      const documents = rows.map(r => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
      sendJson(res, 200, { documents });
      return true;
    } catch (err) {
      sendJson(res, 500, { error: err.message });
      return true;
    }
  }

  // Delete document
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/documents/')) {
    try {
      const db = await getPool();
      if (!db) { sendJson(res, 503, { error: 'Database not available' }); return true; }
      const { rowCount } = await db.query('DELETE FROM documents WHERE id = $1', [documentId]);
      if (rowCount === 0) { sendJson(res, 404, { error: 'Not found' }); return true; }
      sendJson(res, 200, { deleted: true });
      return true;
    } catch (err) {
      sendJson(res, 500, { error: err.message });
      return true;
    }
  }


  // Debug endpoint — check database connectivity
  if (req.method === 'GET' && url.pathname === '/api/debug/db') {
    const info = {
      pgHost: process.env.PGHOST ? process.env.PGHOST.substring(0, 30) + '...' : '(not set)',
      pgDatabase: process.env.PGDATABASE || '(not set)',
      pgUser: process.env.PGUSER ? '***' + process.env.PGUSER.slice(-4) : '(not set)',
      pgPort: process.env.PGPORT || '(not set)',
      pgSslMode: process.env.PGSSLMODE || '(not set)',
      poolAvailable: !!pg,
    };
    if (pg) {
      try {
        const dbg = await getPool();
        const { rows } = await dbg.query('SELECT 1 AS ok');
        info.connected = true;
        info.testQuery = rows[0];
        const tables = await dbg.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        info.tables = tables.rows.map(r => r.tablename);
      } catch (err) {
        info.connected = false;
        info.error = err.message;
      }
    }
    sendJson(res, 200, info);
    return true;
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
