import {loadBootstrap} from './bootstrap.mjs';
import {login, readSession, clearSession} from './auth.mjs';

const byId = id => document.getElementById(id);
const form = byId('login-form');
const select = byId('language');
const status = byId('status');
const error = byId('error');
const submit = byId('submit');
const retry = byId('retry');
let storage;
try { storage = window.sessionStorage; } catch { /* Memory-only login when storage is disabled. */ }
const client = new URLSearchParams(location.search).get('client') || '';
let generation = 0, busy = false, ready = false, active = null, expiryTimer;
function showError(message) { error.textContent = message; error.hidden = !message; }
function closeSession() {
  clearInterval(expiryTimer); clearSession(storage); active = null;
  byId('connected').hidden = true; byId('login-section').hidden = false;
  byId('password').value = ''; byId('username').focus();
}
function connected(session) {
  active = session;
  byId('password').value = '';
  byId('login-section').hidden = true; byId('connected').hidden = false;
  byId('identity').textContent = [session.firstname, session.lastname].filter(Boolean).join(' ');
  byId('current-client').textContent = session.extra?.clientContext?.current?.name || '';
  byId('connected-title').focus();
  clearInterval(expiryTimer);
  // Recheck periodically, including after the tab resumes; no automatic refresh in this phase.
  expiryTimer = setInterval(() => {
    if (active && !readSession({getItem: () => JSON.stringify(active), removeItem() {}})) {
      closeSession(); showError('Votre session a expiré. Veuillez vous reconnecter.');
    }
  }, 10000);
}
async function start(force = false) {
  const run = ++generation; ready = false; submit.disabled = true; retry.hidden = true;
  status.textContent = 'Chargement…'; showError('');
  try {
    const data = await loadBootstrap({language: select.value, client, storage, force});
    if (run !== generation) return;
    document.documentElement.lang = data.language.toLowerCase();
    document.title = data.labels.LoginPageTitle || 'Connexion · Stellar';
    document.querySelectorAll('[data-label]').forEach(node => {
      const value = data.labels[node.dataset.label]; if (value) node.textContent = value;
    });
    if (data.labels.LoginUsernamePlaceholder) byId('username').placeholder = data.labels.LoginUsernamePlaceholder;
    select.replaceChildren(...data.languages.map(item => new Option(item.label, item.code, false, item.code === data.language)));
    status.textContent = ''; ready = true; submit.disabled = busy;
    const existing = readSession(storage); if (existing) connected(existing);
  } catch (failure) {
    if (run !== generation) return;
    status.textContent = failure.message; retry.hidden = false;
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !ready || !form.reportValidity()) return;
  busy = true; submit.disabled = true; select.disabled = true; form.setAttribute('aria-busy', 'true');
  showError(''); status.textContent = 'Connexion en cours…';
  try {
    const {session} = await login({username: byId('username').value, password: byId('password').value, language: select.value, storage});
    status.textContent = ''; connected(session);
  } catch (failure) { showError(failure.message); status.textContent = ''; byId('password').focus(); }
  finally { byId('password').value = ''; busy = false; submit.disabled = !ready; select.disabled = false; form.removeAttribute('aria-busy'); }
});
byId('show-password').addEventListener('click', () => {
  const visible = byId('password').type === 'password'; byId('password').type = visible ? 'text' : 'password';
  byId('show-password').textContent = visible ? 'Masquer' : 'Voir';
  byId('show-password').setAttribute('aria-pressed', String(visible));
  byId('show-password').setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
});
byId('logout').addEventListener('click', closeSession);
select.addEventListener('change', () => start());
retry.addEventListener('click', () => start(true));
start();
