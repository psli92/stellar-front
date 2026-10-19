// Isolated synthetic API: no real account, uploads, or deployed writes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=dirname(fileURLToPath(import.meta.url)),root=resolve(base,'../public');
const forms=JSON.parse(await readFile(resolve(base,'fixtures/forms.json'),'utf8'));
const token='a.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.b';
const clients=[{id:1,name:'Other'},{id:2,name:'Stellar',logoSmallKey:'11111111-1111-1111-1111-111111111111'}];
let current=2,logoReads=0,writeAllowed=true;const writes=[];
const portfolios=[{id:2,name:'Séminaire',context:'Initial',client:clients[1],projects:[],isUser:true}];
const projects=[],activities=[];
const context=()=>({canSwitch:true,current:clients.find(c=>c.id===current),clients});
const types=[{id:1,name:'Narrative',available:true,isAccessible:true,axes:[{id:1,name:'Perspective'}]},{id:2,name:'Unavailable',available:false,axes:[]}];
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost'),path=url.pathname.replace('/EN/','/FR/');
 const send=(data,status=200,extra={})=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({code:status<400?0:status,data,...extra}));};
 if(path==='/api/FR/public/bootstrap'){send({language:'FR',languages:[{code:'FR',label:'Français'}],labels:{},branding:null,cacheTtl:300,revision:'a'.repeat(64)});return;}
 if(path==='/api/FR/login_check'){req.resume();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({token,profile:'bo_webmaster',firstname:'Test',lastname:'User',defaultLanguage:'FR',extra:{consent:true,clientContext:context()}}));return;}
 if(path.startsWith('/api/')){
  assert.equal(req.headers.authorization,'Bearer '+token);
  if(path.startsWith('/api/v1/FR/assets/')){logoReads++;res.writeHead(200,{'Content-Type':'image/svg+xml'});res.end('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="blue"/></svg>');return;}
  if(path==='/api/FR/dashboard'){send({portfolios:[],projects:[],activities:[{id:10,name:'Activité récente',typeName:'TransformationNarrative'}],oneShots:[]},200,{context:{clientContext:context()}});return;}
  if(path.endsWith('/switch')){current=Number(path.split('/')[4]);send(context());return;}
  if(path.startsWith('/api/FR/forms/')){send([],writeAllowed?200:403,{context:{form:forms[path.split('/').at(-1)]}});return;}
  if(path==='/api/FR/settings/profiles'){send({bo_webmaster:['webmaster']});return;}
  if(path==='/api/FR/settings/labelFO'){send({'ActivityType.TransformationNarrative.title':['Transformation narrative'],portfolio:['portefeuille'],portfolios:['portefeuilles'],portfolioIndexTitle:['Portefeuilles'],'ActivityType.Narrative.title':['Transformation narrative'],'Axis.Perspective.title':['Perspectives']},200,{context:{pageCount:1}});return;}
  if(path==='/api/FR/settings/workingLanguages'){send({FR:['Français'],EN:['English']});return;}
  if(path==='/api/FR/activity-types'){send(types);return;}
  if(path==='/api/FR/clients/users/list'){send([{id:10,firstname:'Alice',lastname:'PM',email:'alice@example.invalid',role:'project_manager'},{id:11,firstname:'Service',role:'bo_webmaster'}]);return;}
  const match=path.match(/^\/api\/FR\/(portfolios|projects|activities)(?:\/(\d+))?$/);
  if(match){const [,kind,id]=match,rows={portfolios,projects,activities}[kind];
   if(req.method==='GET'){const row=id?rows.find(r=>r.id===Number(id)):current===2?rows:[];send(row,row?200:404);return;}
   if(!writeAllowed){send(null,403);return;}
   let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);if(body.name==='Existing'){send(null,409);return;}writes.push({method:req.method,kind,id:Number(id),body});
   if(req.method==='PUT'){const item=rows.find(r=>r.id===Number(id));Object.assign(item,body);send(item);return;}
   const item={...body,id:rows.length+10};
   if(kind==='portfolios'){Object.assign(item,{projects:[],isUser:true,client:clients[1]});}
   if(kind==='projects'){Object.assign(item,{activities:[],users:[],isUser:true,portfolio:{id:body.portfolio,name:portfolios.find(p=>p.id===body.portfolio).name},createdOn:'2026-10-19T12:00:00Z'});portfolios.find(p=>p.id===body.portfolio).projects.push(item);}
   if(kind==='activities'){const project=projects.find(p=>p.id===body.project);Object.assign(item,{project:{id:project.id,name:project.name,portfolio:project.portfolio},type:types.find(t=>t.id===body.type)});project.activities.push(item);}
   rows.push(item);send(item);return;
  }
  send(null,404);return;
 }
 try{const file=resolve(root,'.'+(path.startsWith('/assets/')?path:'/index.html'));if(!file.startsWith(root))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const origin='http://127.0.0.1:'+server.address().port;
 await page.goto(origin);await page.waitForFunction(()=>!document.querySelector('#submit').disabled);await page.locator('#username').fill('test@example.invalid');await page.locator('#password').fill('synthetic');await page.locator('#submit').click();await page.locator('#client-avatar img').waitFor();assert.equal(await page.locator('.app-user__role').innerText(),'webmaster');assert.equal(await page.locator('#dashboard-grid .sk-widget-item__meta').innerText(),'Transformation narrative');
 const alignment=await page.locator('.app-sidebar__toggle').evaluate(button=>{const svg=button.querySelector('svg').getBoundingClientRect(),box=button.getBoundingClientRect();return Math.abs(svg.y+svg.height/2-box.y-box.height/2);});assert.ok(alignment<1,'Menu icon is vertically centered');
 await page.getByRole('link',{name:'Voir tous',exact:true}).click();await page.getByRole('button',{name:'Nouveau portefeuille',exact:true}).click();await page.locator('#field-name').fill('Nouveau portefeuille test');await page.locator('#field-context').fill('Contexte de test');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.getByRole('link',{name:'Nouveau portefeuille test',exact:true}).waitFor();
 await page.getByRole('link',{name:'Séminaire',exact:true}).click();await page.getByRole('button',{name:'Contexte',exact:true}).click();assert.equal(await page.locator('#field-context').inputValue(),'Initial');await page.locator('#field-context').fill('Contexte corrigé');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.locator('dialog.workspace-form').waitFor({state:'detached'});await page.getByRole('button',{name:'Nouveau projet',exact:true}).click();await page.locator('#field-name').fill('Existing');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.locator('dialog [role="alert"]').waitFor({state:'visible'});await page.locator('#field-name').fill('Projet test');await page.locator('#field-PMIds').selectOption('10');assert.equal(await page.locator('#field-PMIds option').count(),1);await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.getByRole('link',{name:'Projet test',exact:true}).click();await page.locator('#portfolio-page h1').waitFor();
 assert.equal(await page.locator('.app-breadcrumb').innerText(),'Accueil\nSéminaire\nProjet test');assert.equal(logoReads,1);
 await page.getByRole('link',{name:'Nouvelle activité',exact:true}).click();await page.locator('#activity-type-1').waitFor({state:'attached'});if(process.env.WORKSPACE_SCREENSHOT)await page.screenshot({path:process.env.WORKSPACE_SCREENSHOT.replace('.png','-wizard.png'),fullPage:true});await page.locator('#activity-type-1').check();assert.equal(await page.locator('#activity-type-2').isDisabled(),true);await page.getByRole('button',{name:'Suivant',exact:true}).click();await page.locator('#field-name').fill('Activité test');await page.locator('#field-date').fill('2026-10-19');await page.locator('#field-workingLanguage').selectOption('FR');await page.getByRole('button',{name:'Suivant',exact:true}).click();await page.locator('#field-description').fill('Description');await page.getByRole('button',{name:'Suivant',exact:true}).click();await page.locator('#field-generalContext').fill('Contexte général');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.getByRole('link',{name:'Activité test',exact:true}).click();await page.getByText('Perspectives',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Modifier l’activité',exact:true}).click();await page.locator('#field-name').fill('Activité modifiée');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.getByRole('heading',{name:'Activité modifiée',exact:true}).waitFor();assert.equal(logoReads,1);
 if(process.env.WORKSPACE_SCREENSHOT)await page.screenshot({path:process.env.WORKSPACE_SCREENSHOT,fullPage:true});
 assert.deepEqual(writes.find(w=>w.kind==='portfolios'&&w.method==='PUT').body,{context:'Contexte corrigé'});
 assert.deepEqual(writes.find(w=>w.kind==='projects').body,{name:'Projet test',context:'',PMIds:[10],portfolio:2});
 assert.equal(writes.find(w=>w.kind==='activities'&&w.method==='POST').body.project,10);assert.ok(!('type' in writes.find(w=>w.kind==='activities'&&w.method==='PUT').body));
 await page.locator('#client-trigger').click();await page.locator('[data-client-id="1"]').click();await page.locator('#client-name').getByText('Other',{exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/dashboard');
 current=2;writeAllowed=false;await page.goto(origin+'/projects/10');await page.getByRole('heading',{name:'Projet test',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Nouvelle activité',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Modifier le projet',exact:true}).count(),0);
 await page.goto(origin+'/activities');await page.getByRole('link',{name:'Activité modifiée',exact:true}).waitFor();await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('Workspace browser: labels, stable logos, client dashboard, breadcrumbs, portfolio/project forms, four-step activity creation, edit, strict payloads and permissions: OK');
}finally{if(browser)await browser.close();server.close();}
