import {callApi,ApiError,formatDate} from './dashboard-api.mjs';
import {icon} from './icons.mjs';

export function portfolioPath(path){return /^\/portfolios(?:\/[1-9]\d*)?$/.test(path);}
const validItem=p=>p&&Number.isSafeInteger(p.id)&&p.id>0&&typeof p.name==='string'&&Array.isArray(p.projects)&&p.projects.every(v=>Number.isSafeInteger(v.id)&&v.id>0&&typeof v.name==='string'&&Array.isArray(v.activities));
export async function loadPortfolios(session,language,path,options){
 if(!portfolioPath(path))throw new ApiError('Portfolio invalide.');
 // The list is filtered by the current client on the server. A deep link must
 // belong to that list too: the historical read endpoint is not client-scoped.
 const list=await callApi(session,language,'/portfolios',options);
 if(!Array.isArray(list.data)||!list.data.every(validItem))throw new ApiError('Réponse portfolios incomplète.');
 if(path==='/portfolios')return list.data;
 const id=Number(path.split('/').at(-1));
 if(!list.data.some(p=>p.id===id))throw new ApiError('Portfolio absent ou inaccessible pour le client courant.',404);
 const result=await callApi(session,language,path,options);
 if(!validItem(result.data)||result.data.id!==id)throw new ApiError('Réponse portfolio incomplète.');
 return result.data;
}

export function renderPortfolios(content,data,{language,labels={},navigate,openProject}){
 const text=(k,f)=>labels[k]||f;
 const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
 const list=Array.isArray(data),items=list?data:data.projects;
 const title=list?text('portfolioIndexTitle','Portefeuilles'):data.name;
 content.replaceChildren();
 const region=el('div','app-region'),head=el('div','sk-page-head'),main=el('div','sk-page-head__main');
 if(!list)main.append(el('p','sk-page-head__eyebrow',text('portfolio','Portefeuille')+(data.client?.name?' · '+data.client.name:'')));
 const h1=el('h1','sk-page-head__title',title);h1.tabIndex=-1;
 main.append(h1,el('p','sk-page-head__meta',items.length+' '+text(list?(items.length>1?'portfolios':'portfolio'):(items.length>1?'projects':'project'),list?(items.length>1?'portefeuilles':'portefeuille'):(items.length>1?'projets':'projet'))));head.append(main);region.append(head);content.append(region);
 const body=el('div','app-region');const section=el('section');
 if(!list){const heading=el('h2','sk-section-title',text('projectsLabel','Projets'));heading.id='portfolio-projects';section.setAttribute('aria-labelledby',heading.id);section.append(heading);}
 if(!items.length){const empty=el('div','sk-empty');empty.append(icon('folder-open','sk-empty__icon'),el('p','fw-semibold mb-0',text(list?'portfolioIndexEmptyTitle':'projectIndexEmptyTitle',list?'Aucun portefeuille':'Aucun projet')),el('p','mb-0',text(list?'portfolioIndexEmpty':'portfolioDetailProjectsEmpty',list?'Aucun portefeuille à afficher pour le client courant.':'Ce portefeuille ne contient pas encore de projet.')));section.append(empty);}
 else{const grid=el('div','sk-grid');for(const item of items){
  const card=el('article','sk-card sk-card--linked');card.append(el('p','sk-card__eyebrow',text(list?'portfolio':'project',list?'Portefeuille':'Projet')));
  const heading=el(list?'h2':'h3','sk-card__title'),link=el('a','sk-card__link',item.name);link.href=(list?'/portfolios/':'/projects/')+item.id;
  link.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();list?navigate(link.pathname):openProject('/projects/'+item.id,item.name);});heading.append(link);card.append(heading);
  if(!list&&item.portfolio?.name)card.append(el('p','sk-card__body',item.portfolio.name));
  const footer=el('div','sk-card__footer');const activityCount=list?item.projects.reduce((n,p)=>n+p.activities.length,0):item.activities.length;
  const count=activityCount+' '+text(activityCount>1?'activities':'activity',activityCount>1?'activités':'activité');
  footer.append(el('span','',list?item.projects.length+' '+text(item.projects.length>1?'projects':'project',item.projects.length>1?'projets':'projet')+' · '+count:count));
  if(!list&&item.createdOn){const badge=el('span','sk-badge sk-badge--neutral');badge.append(icon('calendar'),document.createTextNode(formatDate(item.createdOn,language)));footer.append(badge);}
  card.append(footer);grid.append(card);
 }section.append(grid);}body.append(section);content.append(body);return title;
}
