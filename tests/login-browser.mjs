// Synthetic local API only. No deployed credentials or production data.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../public');
const bootstrap={language:'FR',languages:[{code:'FR',label:'Français'},{code:'EN',label:'English'}],labels:{AppTitle:'Stellar - Cockpit AI',loginEnterCredentials:'Bienvenue. Entrez vos identifiants pour continuer.',LoginUsername:'Email',LoginUsernamePlaceholder:'mon-compte@youarestellar.fr',LoginTitle:'Connexion',loginIntro:'Donnez du sens à vos conversations.',loginSubIntro:'Retrouvez votre espace de travail.'},branding:null,cacheTtl:300,revision:'a'.repeat(64)};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.synthetic';
let attempts=0, current=1, portfolioState="normal";
const clients=[{id:1,name:"Client A"},{id:2,name:"Client B",logoSmallKey:'11111111-1111-1111-1111-111111111111'}];
const context=()=>({canSwitch:true,current:clients.find(c=>c.id===current),clients});
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');const requestedLanguage=url.pathname.includes('/EN/')?'EN':'FR';url.pathname=url.pathname.replace('/EN/','/FR/');
 if(url.pathname==='/api/v1/FR/assets/11111111-1111-1111-1111-111111111111'){assert.equal(req.headers.authorization,'Bearer '+token);res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="blue"/></svg>');return;}
 if(url.pathname.startsWith('/api/FR/forms/')){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({code:403}));return;}
 if(url.pathname==='/api/FR/public/bootstrap'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:0,data:{...bootstrap,language:requestedLanguage}}));return;}
 if(url.pathname==='/api/FR/dashboard'){
  assert.equal(req.headers.authorization,'Bearer '+token);res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({code:0,context:{clientContext:context()},data:{portfolios:[{id:current,name:'Portfolio '+current,clientName:context().current.name,projectCount:2,activityCount:3,updatedOn:{date:'2026-10-02 06:28:24.000000',timezone:'UTC'}}],projects:Array.from({length:20},(_,i)=>({id:i+1,name:'Long project '+i,portfolioName:'Portfolio',activityCount:1,updatedOn:{date:'2026-10-15 10:00:00.000000',timezone:'UTC'}})),activities:[],oneShots:[]}}));return;
 }
 if(/^\/api\/FR\/clients\/[12]\/switch$/.test(url.pathname)){
  assert.equal(req.method,'PUT');assert.equal(req.headers.authorization,'Bearer '+token);current=Number(url.pathname.split('/')[4]);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:0,data:context()}));return;
 }
 if(url.pathname==='/api/FR/portfolios'){if(portfolioState!=='normal'){res.setHeader('Content-Type','application/json');res.statusCode=portfolioState==='denied'?403:200;res.end(JSON.stringify({code:portfolioState==='denied'?-1:0,data:[]}));return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:0,data:[{id:current,name:'Portfolio '+current,projects:[{id:7,name:'Project',activities:[]}]}]}));return;}
 if(url.pathname==='/api/FR/portfolios/2'){
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:0,data:{id:2,name:'Portfolio 2',context:'Example',client:{id:2,name:'Client B'},projects:[{id:7,name:'Project',activities:[],createdOn:'2026-10-15T13:24:24+00:00'}]}}));return;
 }
 if(url.pathname==='/api/FR/login_check'){
  attempts++;let body='';for await(const chunk of req)body+=chunk;
  const credentials=JSON.parse(body);assert.deepEqual(Object.keys(credentials),['username','password']);assert.equal(req.headers.authorization,undefined);
  res.setHeader('Content-Type','application/json');
  if(credentials.password!=='synthetic-success'){res.writeHead(401);res.end(JSON.stringify({code:'-1',message:'Never echo provider detail'}));return;}
  await new Promise(r=>setTimeout(r,200));
  res.end(JSON.stringify({token,refresh_token:'unused-refresh',profile:'bo_webmaster',firstname:'Test',lastname:'User',defaultLanguage:'FR',extra:{consent:true,clientContext:{current:{name:'Client test'}}}}));return;
 }
 try{
  const path=resolve(root,'.'+(!url.pathname.startsWith('/assets/')?'/index.html':url.pathname));if(!path.startsWith(root))throw Error();
  const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.png':'image/png','.ttf':'font/ttf','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>!document.querySelector('#submit').disabled);
 await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.login-form-wrapper').evaluate(e=>e.getBoundingClientRect().width),352);
 assert.equal(await page.locator('#username').evaluate(e=>getComputedStyle(e).borderRadius),'999px');
 await page.locator('#username').evaluate(e=>e.blur());
 if(process.env.LOGIN_SCREENSHOT)await page.screenshot({path:process.env.LOGIN_SCREENSHOT,fullPage:true});
 await page.locator('#username').fill('TEST@example.invalid');await page.locator('#password').fill('wrong');await page.locator('#submit').click();
 await page.locator('#error').waitFor({state:'visible'});assert.match(await page.locator('#error').innerText(),/incorrect/);assert.equal(await page.locator('#password').inputValue(),'');
 await page.locator('#password').fill('synthetic-success');
 await page.evaluate(()=>{const f=document.querySelector('#login-form');f.requestSubmit();f.requestSubmit();});
 await page.locator('#dashboard-grid .sk-widget-item').first().waitFor({state:'visible'});assert.equal(attempts,2);assert.match(await page.locator('.dashboard-user').innerText(),/Test USER/);
 assert.equal(await page.locator('#client-name').innerText(),'Client A');
 await page.locator('#client-trigger').click();await page.locator('[data-client-id="2"]').click();await page.getByText('Portfolio 2',{exact:true}).waitFor();
 assert.equal(await page.getByText('Portfolio 1',{exact:true}).count(),0);
 await page.locator('#client-avatar img').waitFor();assert.equal(await page.getByRole('button',{name:'Actualiser',exact:true}).count(),0);
 const overflow=await page.locator('.sk-widget__body').nth(1).evaluate(e=>({scroll:e.scrollHeight,height:e.clientHeight,overflow:getComputedStyle(e).overflowY}));assert.ok(overflow.scroll>overflow.height);assert.equal(overflow.overflow,'auto');assert.equal(await page.locator('#dashboard-results-region').evaluate(e=>getComputedStyle(e).paddingTop),'0px');
 await page.locator('#language-trigger').click();await page.locator('[data-language="EN"]').click();await page.waitForFunction(()=>document.documentElement.lang==='en');await page.locator('#dashboard-grid .sk-widget-item').first().waitFor();
 await page.locator('#language-trigger').click();await page.locator('[data-language="FR"]').click();await page.waitForFunction(()=>document.documentElement.lang==='fr');await page.locator('#dashboard-grid .sk-widget-item').first().waitFor();
 if(process.env.DASHBOARD_SCREENSHOT)await page.screenshot({path:process.env.DASHBOARD_SCREENSHOT,fullPage:true});
 await page.getByText('Portfolio 2',{exact:true}).click();await page.locator('#portfolio-page h1').waitFor();assert.equal(new URL(page.url()).pathname,'/portfolios/2');assert.equal(await page.locator('#portfolio-page h1').innerText(),'Portfolio 2');await page.getByText('Project',{exact:true}).waitFor();
 if(process.env.PORTFOLIO_SCREENSHOT)await page.screenshot({path:process.env.PORTFOLIO_SCREENSHOT,fullPage:true});
 await page.reload();await page.locator('#portfolio-page h1').waitFor();assert.equal(new URL(page.url()).pathname,'/portfolios/2');
 await page.locator('.app-brand').click();await page.getByRole('link',{name:'Voir tous',exact:true}).click();await page.locator('#portfolio-page .sk-card').waitFor();assert.equal(await page.locator('#portfolio-page .sk-card__footer').innerText(),'1 projet · 0 activité');
 if(process.env.PORTFOLIO_SCREENSHOT)await page.screenshot({path:process.env.PORTFOLIO_SCREENSHOT.replace('.png','-list.png'),fullPage:true});
 await page.getByText('Portfolio 2',{exact:true}).click();await page.locator('#portfolio-page h1').waitFor();
 await page.locator('#client-trigger').click();await page.locator('[data-client-id="1"]').click();await page.getByText('Portfolio 1',{exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/dashboard');assert.equal(await page.getByText('Portfolio 2',{exact:true}).count(),0);
 await page.locator('#client-trigger').click();await page.locator('[data-client-id="2"]').click();await page.getByText('Portfolio 2',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Voir tous',exact:true}).click();await page.locator('#portfolio-page h1').waitFor();await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('#portfolio-page .sk-card').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 portfolioState='empty';await page.reload();await page.locator('#portfolio-page .sk-empty').waitFor();
 portfolioState='denied';await page.reload();await page.locator('#dashboard-error').waitFor({state:'visible'});assert.equal(await page.locator('#portfolio-page .sk-card').count(),0);
 portfolioState='normal';await page.setViewportSize({width:1440,height:900});if(await page.locator('.app-sidebar.is-collapsed').count())await page.locator('.app-sidebar__toggle').click();await page.locator('.app-brand').click();
 const saved=await page.evaluate(()=>sessionStorage.getItem('stellar:user-session:v1'));assert.ok(!saved.includes('unused-refresh'));assert.ok(!saved.includes('synthetic-success'));
 await page.reload();await page.locator('#dashboard-grid .sk-widget-item').first().waitFor({state:'visible'});assert.equal(await page.locator('#client-name').innerText(),'Client B');
 await page.getByRole('button',{name:'Menu utilisateur',exact:true}).click();
 await page.getByRole('button',{name:'Fermer la session sur cet onglet',exact:true}).click();assert.equal(await page.evaluate(()=>sessionStorage.getItem('stellar:user-session:v1')),null);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.login-brand-panel').isVisible(),false);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(process.env.LOGIN_SCREENSHOT)await page.screenshot({path:process.env.LOGIN_SCREENSHOT.replace('.png','-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('Login browser: layout, errors, raw login, double-submit guard, per-tab session, reload, client switch, authoritative reload, detail, local sign-out and mobile: OK');
}finally{if(browser)await browser.close();server.close();}

