// Synthetic local API only. No deployed credentials or production data.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../public');
const bootstrap={language:'FR',languages:[{code:'FR',label:'Français'}],labels:{AppTitle:'Stellar - Cockpit AI',loginEnterCredentials:'Bienvenue. Entrez vos identifiants pour continuer.',LoginUsername:'Email',LoginUsernamePlaceholder:'mon-compte@youarestellar.fr',LoginTitle:'Connexion',loginIntro:'Donnez du sens à vos conversations.',loginSubIntro:'Retrouvez votre espace de travail.'},branding:null,cacheTtl:300,revision:'a'.repeat(64)};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.synthetic';
let attempts=0, current=1;
const clients=[{id:1,name:"Client A"},{id:2,name:"Client B"}];
const context=()=>({canSwitch:true,current:clients.find(c=>c.id===current),clients});
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/FR/public/bootstrap'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:0,data:bootstrap}));return;}
 if(url.pathname==='/api/FR/dashboard'){
  assert.equal(req.headers.authorization,'Bearer '+token);res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({code:0,context:{clientContext:context()},data:{portfolios:[{id:current,name:'Portfolio '+current,clientName:context().current.name,projectCount:2,activityCount:3,updatedOn:{date:'2026-10-02 06:28:24.000000',timezone:'UTC'}}],projects:[],activities:[],oneShots:[]}}));return;
 }
 if(url.pathname==='/api/FR/clients/2/switch'){
  assert.equal(req.method,'PUT');assert.equal(req.headers.authorization,'Bearer '+token);current=2;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:0,data:context()}));return;
 }
 if(url.pathname==='/api/FR/portfolios/2'){
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:0,data:{id:2,name:'Portfolio 2',context:'Example',projects:[{name:'Project'}]}}));return;
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
  const path=resolve(root,'.'+(['/','/dashboard'].includes(url.pathname)?'/index.html':url.pathname));if(!path.startsWith(root))throw Error();
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
 await page.locator('#dashboard-grid .sk-widget-item').waitFor({state:'visible'});assert.equal(attempts,2);assert.match(await page.locator('.dashboard-user').innerText(),/Test USER/);
 assert.equal(await page.locator('#client-name').innerText(),'Client A');
 await page.locator('#client-trigger').click();await page.locator('[data-client-id="2"]').click();await page.getByText('Portfolio 2',{exact:true}).waitFor();
 assert.equal(await page.getByText('Portfolio 1',{exact:true}).count(),0);
 if(process.env.DASHBOARD_SCREENSHOT)await page.screenshot({path:process.env.DASHBOARD_SCREENSHOT,fullPage:true});
 await page.getByText('Portfolio 2',{exact:true}).click();await page.locator('dialog[open]').waitFor();await page.getByText('Example',{exact:true}).waitFor();await page.getByRole('button',{name:'Fermer',exact:true}).click();
 const saved=await page.evaluate(()=>sessionStorage.getItem('stellar:user-session:v1'));assert.ok(!saved.includes('unused-refresh'));assert.ok(!saved.includes('synthetic-success'));
 await page.reload();await page.locator('#dashboard-grid .sk-widget-item').waitFor({state:'visible'});assert.equal(await page.locator('#client-name').innerText(),'Client B');
 await page.getByRole('button',{name:'Menu utilisateur',exact:true}).click();
 await page.getByRole('button',{name:'Fermer la session sur cet onglet',exact:true}).click();assert.equal(await page.evaluate(()=>sessionStorage.getItem('stellar:user-session:v1')),null);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.login-brand-panel').isVisible(),false);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(process.env.LOGIN_SCREENSHOT)await page.screenshot({path:process.env.LOGIN_SCREENSHOT.replace('.png','-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('Login browser: layout, errors, raw login, double-submit guard, per-tab session, reload, client switch, authoritative reload, detail, local sign-out and mobile: OK');
}finally{if(browser)await browser.close();server.close();}

