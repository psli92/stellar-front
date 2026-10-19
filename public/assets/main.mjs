import {loadBootstrap} from './bootstrap.mjs';

const select = document.querySelector('#language');
const status = document.querySelector('#status');
const retry = document.querySelector('#retry');
const params = new URLSearchParams(location.search);
const client = params.get('client') || '';
let storage;
try { storage = window.sessionStorage; } catch { /* Browser policy can disable storage. */ }
let generation = 0;
async function start(force = false) {
  const run = ++generation;
  retry.hidden = true;
  status.textContent = 'Chargement…';
  try {
    const data = await loadBootstrap({language: select.value, client, storage, force});
    if (run !== generation) return;
    document.documentElement.lang = data.language.toLowerCase();
    document.title = data.branding?.name || data.labels.AppTitle || 'Stellar';
    document.querySelector('#title').textContent = data.branding?.name || data.labels.AppTitle || 'Bienvenue.';
    document.querySelector('#intro').textContent = data.labels.loginIntro || 'Bienvenue dans votre espace Stellar.';
    select.replaceChildren(...data.languages.map(language => new Option(language.label, language.code, false, language.code === data.language)));
    status.textContent = 'Votre espace est prêt. Les écrans de connexion seront ajoutés à la prochaine étape.';
  } catch (error) {
    if (run !== generation) return;
    status.textContent = error.message;
    retry.hidden = false;
  }
}
select.addEventListener('change', () => start());
retry.addEventListener('click', () => start(true));
start();
