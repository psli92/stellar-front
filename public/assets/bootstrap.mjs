const CACHE_PREFIX = 'stellar:public:v1:';

function valid(data, language) {
  return data && data.language === language && Array.isArray(data.languages)
    && data.languages.length > 0 && data.languages.every(x => /^[A-Z]{2,3}$/.test(x.code) && typeof x.label === 'string')
    && data.labels && typeof data.labels === 'object' && !Array.isArray(data.labels)
    && Object.values(data.labels).every(x => typeof x === 'string')
    && typeof data.revision === 'string' && /^[a-f0-9]{64}$/.test(data.revision)
    && Number.isInteger(data.cacheTtl) && data.cacheTtl > 0 && data.cacheTtl <= 300
    && (data.branding === null || (typeof data.branding?.name === 'string' && typeof data.branding?.subdomain === 'string'));
}

export async function loadBootstrap({language = 'FR', client = '', storage, fetcher = fetch, now = Date.now, force = false} = {}) {
  language = language.toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(language) || (client && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(client))) {
    throw new Error('Paramètres de démarrage invalides.');
  }
  const key = CACHE_PREFIX + language + ':' + client;
  if (!force) {
    try {
      const item = JSON.parse(storage?.getItem(key) || 'null');
      if (item?.expires > now() && item.expires <= now() + 300000 && valid(item.data, language)) return item.data;
    } catch { /* Storage can be disabled or stale. Fetch fresh public data. */ }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const suffix = client ? '?client=' + encodeURIComponent(client) : '';
    const response = await fetcher('/api/' + language + '/public/bootstrap' + suffix, {
      method: 'GET', headers: {Accept: 'application/json'}, credentials: 'omit', cache: 'no-store', signal: controller.signal
    });
    const body = await response.json();
    if (!response.ok || String(body.code) !== '0' || !valid(body.data, language)) throw new Error('Bootstrap unavailable');
    try { storage?.setItem(key, JSON.stringify({expires: now() + body.data.cacheTtl * 1000, data: body.data})); } catch { /* Optional cache. */ }
    return body.data;
  } catch {
    throw new Error('Votre espace est momentanément indisponible. Veuillez réessayer.');
  } finally { clearTimeout(timer); }
}
