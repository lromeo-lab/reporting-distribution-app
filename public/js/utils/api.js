export async function loadDocument(documentId = 'default') {
  const response = await fetch(`/api/documents/${documentId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to load document: ${response.status}`);
  }

  return response.json();
}

export async function saveDocument(documentId = 'default', content) {
  const response = await fetch(`/api/documents/${documentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Unable to save document: ${response.status}`);
  }

  return response.json();
}


export async function listDocuments() {
  const response = await fetch('/api/documents');
  if (!response.ok) throw new Error(`List failed: ${response.status}`);
  return response.json();
}

export async function deleteDocument(documentId) {
  const response = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
  return response.json();
}
export async function fetchDashboards() {
  const response = await fetch('/api/proxy/dashboards');
  if (!response.ok) {
    let detail = `status ${response.status}`;
    try { const body = await response.json(); detail = body.error || detail; } catch (_) {}
    throw new Error(detail);
  }
  return response.json();
}

export async function fetchDashboardWidgets(dashboardId) {
  const response = await fetch(`/api/proxy/dashboards/${dashboardId}/widgets`);
  if (!response.ok) throw new Error(`Widget list failed: ${response.status}`);
  return response.json();
}

export async function fetchProxyConfig() {
  const response = await fetch('/api/proxy/config');
  if (!response.ok) throw new Error(`Config failed: ${response.status}`);
  return response.json();
}
