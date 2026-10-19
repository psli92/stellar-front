import {dashboard} from './dashboard.mjs';
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
let generation = 0, busy = false, ready = false, active = null, expiryTimer, publicLabels = {}, availableLanguages = [];
const dashboardView = dashboard(byId('dashboard'), {onClose: closeSession, onLanguage: changeLanguage, onExpired: message => {closeSession();showError(message);}, onSession: session => {active=session;try{storage?.setItem('stellar:user-session:v1',JSON.stringify(session));}catch{}}});
async function changeLanguage(code){
 const before=active;if(!before)return;
 try{const data=await loadBootstrap({language:code,client,storage});if(active!==before)return;publicLabels=data.labels;availableLanguages=data.languages;select.value=data.language;document.documentElement.lang=data.language.toLowerCase();try{storage?.setItem('stellar:language',data.language);}catch{}dashboardView.show(active,data.language,publicLabels,availableLanguages);}
 catch{throw new Error('Changement de langue indisponible. Réessayez.');}
}
try{const preferred=storage?.getItem('stellar:language');if(/^[A-Z]{2,3}$/.test(preferred||''))select.value=preferred;}catch{}
function showError(message) { error.textContent = message; error.hidden = !message; }
function closeSession() {
  clearInterval(expiryTimer); clearSession(storage); active = null;
  dashboardView.hide(); byId('login-layout').hidden=false; byId('connected').hidden = true; byId('login-section').hidden = false;history.replaceState(null,'','/');
  byId('password').value = ''; byId('username').focus();
}
function connected(session) {
  active = session;
  byId('password').value = '';
  byId('login-layout').hidden=true;if(!/^\/portfolios(?:\/[1-9]\d*)?$/.test(location.pathname))history.replaceState(null,'','/dashboard'+location.search);
  dashboardView.show(session,select.value,publicLabels,availableLanguages);
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
    publicLabels = data.labels; availableLanguages = data.languages;
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
document.querySelectorAll('[data-pending]').forEach(button=>button.addEventListener('click',()=>byId('pending-dialog').showModal()));
byId('logout').addEventListener('click', closeSession);
select.addEventListener('change', () => start());
retry.addEventListener('click', () => start(true));
start();
