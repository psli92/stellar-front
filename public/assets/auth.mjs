const SESSION_KEY = 'stellar:user-session:v1';
const TOKEN = /^[A-Za-z0-9._~-]{1,8192}$/;
export class LoginError extends Error {}

function expires(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return Number.isSafeInteger(payload.exp) ? payload.exp * 1000 : 0;
  } catch { return 0; }
}

// Decoding exp is only a UI expiry hint. Every protected API must validate the JWT itself.
function valid(session, now) {
  return session && typeof session.token === 'string' && TOKEN.test(session.token)
    && expires(session.token) > now && typeof session.profile === 'string' && session.profile !== 'anonymous'
    && typeof session.firstname === 'string' && typeof session.lastname === 'string';
}

export function clearSession(storage) {
  try { storage?.removeItem(SESSION_KEY); } catch { /* No persistent session was available. */ }
}
export function readSession(storage, now = Date.now()) {
  try {
    const session = JSON.parse(storage?.getItem(SESSION_KEY) || 'null');
    if (valid(session, now)) return session;
  } catch { /* Malformed or unavailable storage. */ }
  clearSession(storage);
  return null;
}

export async function login({username, password, language = 'FR', storage, fetcher = fetch, now = Date.now()}) {
  clearSession(storage);
  if (!/^[A-Za-z]{2,3}$/.test(language) || typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    throw new LoginError('Renseignez votre identifiant et votre mot de passe.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetcher('/api/' + language.toUpperCase() + '/login_check', {
      method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({username: username.trim().toLowerCase(), password})
    });
    let body;
    try { body = await response.json(); } catch { throw new LoginError('Le service de connexion est momentanément indisponible.'); }
    if (!response.ok) {
      if ([400, 401, 403].includes(response.status)) throw new LoginError('Identifiant ou mot de passe incorrect, ou accès refusé.');
      if (response.status === 429) throw new LoginError('Trop de tentatives. Veuillez patienter avant de réessayer.');
      throw new LoginError('Le service de connexion est momentanément indisponible.');
    }
    if (body.must_change_password === true) throw new LoginError('Votre mot de passe doit être renouvelé. Utilisez le parcours de renouvellement actuel avant de vous connecter ici.');
    if (body.mfa_required === true) throw new LoginError('La double authentification n’est pas encore disponible sur ce nouveau front.');
    const session = {token: body.token, profile: body.profile, firstname: body.firstname, lastname: body.lastname,
      defaultLanguage: body.defaultLanguage, extra: body.extra};
    if (!valid(session, now) || !session.extra || typeof session.extra.consent !== 'boolean' || !session.extra.clientContext) {
      throw new LoginError('La connexion n’a pas pu être finalisée. Veuillez réessayer.');
    }
    // Access token only, per tab. Never store the password, service credentials or unused refresh token.
    let persisted = false;
    try { storage?.setItem(SESSION_KEY, JSON.stringify(session)); persisted = Boolean(storage); } catch { /* In-memory session remains usable. */ }
    return {session, persisted};
  } catch (error) {
    if (error instanceof LoginError) throw error;
    throw new LoginError('Connexion impossible. Vérifiez votre réseau et réessayez.');
  } finally { clearTimeout(timer); }
}
