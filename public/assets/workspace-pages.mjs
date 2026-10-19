import {oneShotPath,loadOneShot,renderOneShot} from './oneshots.mjs';
import {activityPath,loadActivityExtras} from './activity-api.mjs';
import {renderAxis} from './activity-contributions.mjs';
import {enhanceActivity,renderNarrative} from './activity-narrative.mjs';
import {workspaceLabels} from './workspace-labels.mjs';
import {callApi,ApiError,formatDate} from './dashboard-api.mjs';
import {loadPortfolios,renderPortfolios} from './portfolios.mjs';
import {allowedForm,node} from './workspace-forms.mjs';
import {activityWizard} from './activity-wizard.mjs';
import {icon} from './icons.mjs';
export const workspacePath=path=>oneShotPath(path)||activityPath(path)||/^\/(?:portfolios|projects|activities)(?:\/[1-9]\d*)?$/.test(path)||/^\/portfolios\/[1-9]\d*\/projects\/[1-9]\d*\/activity\/form$/.test(path);
const valid=item=>item&&Number.isSafeInteger(item.id)&&item.id>0&&typeof item.name==='string';
export async function loadWorkspace(session,language,path,options){
 if(oneShotPath(path))return loadOneShot(session,language,path,options);
 if(!workspacePath(path))throw new ApiError('Adresse invalide.');
 const special=activityPath(path);const clean=path.split('?')[0];const parts=clean.split('/'),wizard=path.endsWith('/activity/form'),kind=special?'activities':wizard?'projects':parts[1];let data;
 if(kind==='portfolios')data=await loadPortfolios(session,language,path,options);
 else{const list=await callApi(session,language,'/'+kind,options);if(!Array.isArray(list.data)||!list.data.every(valid))throw new ApiError('Liste incomplète.');const id=wizard?Number(parts[4]):Number(parts[2]);if(!id)data=list.data;else{if(!list.data.some(i=>i.id===id))throw new ApiError('Élément absent ou inaccessible pour le client courant.',404);const result=await callApi(session,language,'/'+kind+'/'+id,options);if(!valid(result.data)||result.data.id!==id)throw new ApiError('Réponse incomplète.');data=result.data;}}
 const forms={};const names=kind==='portfolios'?(Array.isArray(data)?['PortfolioCreate']:data.isUser?['PortfolioUpdate','ProjectCreateFromPortfolio']:[]):kind==='projects'&&!Array.isArray(data)&&data.isUser?['ProjectUpdate','ActivityUpdate']:kind==='activities'&&!Array.isArray(data)?['ActivityUpdate']:[];
 await Promise.all(names.map(async name=>{forms[name]=await allowedForm(session,language,name,options);}));
 const page={kind,data,forms,wizard,labels:await workspaceLabels(session,language,options)};if(kind==='activities'&&!Array.isArray(data)){page.extras=await loadActivityExtras(data,session,language,options?.signal);if(special){page.special=true;page.mode=parts[3]==='axes'?'axis':parts[4];if(page.mode==='axis'){page.axis=(data.type?.axes||data.axes||[]).find(a=>a.id===Number(parts[4]));if(!page.axis)throw new ApiError('Axe inaccessible pour cette activité.',404);}if(page.mode==='result')page.generation=Number(new URLSearchParams(path.split('?')[1]||location.search).get('generation'));}}
 if(wizard){if(data.portfolio?.id!==Number(parts[2])||!forms.ActivityUpdate)throw new ApiError('Création d’activité interdite.',403);const [types,languages]=await Promise.all([callApi(session,language,'/activity-types',options),callApi(session,language,'/settings/workingLanguages',options)]);if(!Array.isArray(types.data)||!languages.data||Array.isArray(languages.data))throw new ApiError('Référentiels incomplets.');page.types=types.data;page.workingLanguages=Object.entries(languages.data).map(([value,row])=>({value,label:row[0]||value}));}
 return page;
}
export function workspaceBrowserTitle(page,labels={}){
 const t=(key,fallback)=>labels[key]||fallback;const {data,kind}=page;
 if(page.wizard)return t('NewActivityPageTitle','Nouvelle activité');
 if(page.special){if(page.mode==='axis')return t('axe_page_title','Contributions');const keys={analysis:'AnalysePageTitle',parameters:'NarrativeParametersTitle',result:'NarrativeResultTitle',history:'HistoryPageTitle'};return data.name+' - '+t(keys[page.mode],'Narratif');}
 const entity={portfolios:'portfolio',projects:'project',activities:'activity'}[kind];
 if(Array.isArray(data))return t(entity+'IndexTitle',{portfolio:'Portefeuilles',project:'Projets',activity:'Activités'}[entity]);
 return data.name+' - '+(kind==='activities'?t('ActivityType.'+data.type?.name+'.title',data.type?.name||'Activité'):t(entity+'DetailTitle',entity==='portfolio'?'Portefeuille':'Projet'));
}
export function renderWorkspace(content,page,options){
 if(page.oneShot)return renderOneShot(content,page,options);
 const {language,navigate,openForm,session,signal,onSaving,onSaved,onExpired}=options;const labels={...options.labels,...page.labels};const {kind,data,forms,wizard}=page;
 const text=(key,fallback)=>labels[key]||fallback;
 const browserTitle=workspaceBrowserTitle(page,labels);
 const crumbs=[['/dashboard',text('home','Accueil')]];
 const parent=kind==='projects'?data.portfolio:kind==='activities'?data.project?.portfolio:null;
 if(parent)crumbs.push(['/portfolios/'+parent.id,parent.name]);
 if(kind==='activities'&&data.project)crumbs.push(['/projects/'+data.project.id,data.project.name]);
 if(page.special){content.replaceChildren();crumbs.push(['/activities/'+data.id,data.name]);if(page.mode==='axis')renderAxis(content,page,options);else renderNarrative(content,page,options);return {browserTitle,title:page.mode==='axis'?text('Axis.'+page.axis.name+'.title',page.axis.name):text(page.mode==='history'?'HistoryBreadcrumb':'labelAnalyseSynthesise','Analyser et synthétiser'),crumbs};}
 if(wizard){content.replaceChildren();activityWizard(content,{...page,project:data,language,labels,session,signal,onSaving,onSaved:()=>onSaved('/projects/'+data.id),onExpired});crumbs.push(['/projects/'+data.id,data.name]);return {browserTitle,title:text('NewActivityTitle','Nouvelle activité'),crumbs};}
 const list=Array.isArray(data);
 let title;
 if(kind==='portfolios'){title=renderPortfolios(content,data,{language,labels,navigate,openProject:url=>navigate(url)});}
 else{
  title=list?text(kind,kind==='projects'?'Projets':'Activités'):data.name;content.replaceChildren();
  const region=node('div','app-region'),head=node('div','sk-page-head'),main=node('div','sk-page-head__main');head.append(main);region.append(head);content.append(region);
  if(!list)main.append(node('p','sk-page-head__eyebrow',kind==='projects'?[text('project','Projet'),data.portfolio?.client?.name].filter(Boolean).join(' · '):text('ActivityType.'+data.type?.name+'.title',data.type?.name||'Activité')));
  main.append(node('h1','sk-page-head__title',title));
  const items=list?data:kind==='projects'?data.activities||[]:data.type?.axes||data.axes||[];
  main.append(node('p','sk-page-head__meta',!list&&kind==='activities'?[data.project?.name,parent?.name,formatDate(data.date,language),data.workingLanguage].filter(Boolean).join(' · '):items.length+' '+text(list?kind:items.length>1?'activities':'activity',list?(kind==='projects'?'projets':'activités'):items.length>1?'activités':'activité')));
  const body=node('div','app-region'),section=node('section');body.append(section);content.append(body);
  if(!list)section.append(node('h2','sk-section-title',kind==='projects'?text('activitiesLabel','Activités'):text('workAxis','Axes de travail')));
  if(!items.length){const empty=node('div','sk-empty');empty.append(icon('folder-open','sk-empty__icon'),node('p','fw-semibold mb-0',list?'Aucun élément':kind==='projects'?'Aucune activité':'Aucun axe de travail'));section.append(empty);}
  else{const grid=node('div','sk-grid');section.append(grid);for(const [index,item] of items.entries()){const axis=!list&&kind==='activities',activity=kind==='activities'&&list||kind==='projects'&&!list;
   const card=node('article','sk-card'+(axis?' sk-card--axis':' sk-card--linked'));card.append(node('p','sk-card__eyebrow',axis?text('axis','Axe')+' '+(index+1):activity?text('ActivityType.'+item.type?.name+'.title',item.type?.name||text('activity','Activité')):text('project','Projet')));
   const h=node(list?'h2':'h3','sk-card__title');if(axis)h.textContent=text('Axis.'+item.name+'.title',item.name);else{const a=node('a','sk-card__link',item.name);a.href=(activity?'/activities/':'/projects/')+item.id;a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(a.pathname);});h.append(a);}card.append(h);
   if(axis)card.append(node('p','sk-card__body',text('Axis.'+item.name+'.description','')));
   else{const footer=node('div','sk-card__footer');const date=node('span');if(activity)date.append(icon('calendar'),document.createTextNode(formatDate(item.date,language)));else date.textContent=(item.activities?.length||0)+' '+text((item.activities?.length||0)>1?'activities':'activity',(item.activities?.length||0)>1?'activités':'activité');footer.append(date);if(activity&&item.workingLanguage){const badge=node('span','sk-badge sk-badge--neutral');badge.append(icon('language'),node('span','visually-hidden',text('ActivityForm.workingLanguage.label','Langue')+' :'),document.createTextNode(item.workingLanguage.toUpperCase()));footer.append(badge);}card.append(footer);}grid.append(card);
  }}
  
 }
 const actions=node('div','sk-page-head__actions');
 function action(label,name,entity,primary=false){if(!forms[name])return;const button=node('button',primary?'btn btn-primary':'btn btn-ghost');button.type='button';button.append(icon(primary?'plus':'pen'),document.createTextNode(label));button.addEventListener('click',()=>openForm(name,forms[name],entity));actions.append(button);}
 if(kind==='portfolios'){if(list)action(text('actionAddPortfolio','Nouveau portefeuille'),'PortfolioCreate',{},true);else{action(text('portfolioContext','Contexte'),'PortfolioUpdate',data);action(text('actionAddProject','Nouveau projet'),'ProjectCreateFromPortfolio',data,true);}}
 if(kind==='projects'&&!list){action(text('actionEditProject','Modifier le projet'),'ProjectUpdate',data);if(forms.ActivityUpdate){const a=node('a','btn btn-primary');a.append(icon('plus'),document.createTextNode(text('actionAddActivity','Nouvelle activité')));a.href='/portfolios/'+data.portfolio.id+'/projects/'+data.id+'/activity/form';a.addEventListener('click',e=>{e.preventDefault();navigate(a.pathname);});actions.append(a);}}
 if(kind==='activities'&&!list)action(text('actionEditActivity','Modifier l’activité'),'ActivityUpdate',data);
 if(actions.childNodes.length)content.querySelector('.sk-page-head').append(actions);
 if(kind==='activities'&&!list){
  const meta=content.querySelector('.sk-page-head__meta');meta.replaceChildren(document.createTextNode([data.project?.name,parent?.name,formatDate(data.date,language)].filter(Boolean).join(' · ')));
  if(data.workingLanguage){const badge=node('span','sk-badge sk-badge--neutral');badge.append(icon('language'),document.createTextNode(text('ActivityForm.workingLanguage.label','Langue')+' : '+data.workingLanguage.toUpperCase()));meta.append(document.createTextNode(' · '),badge);}
  enhanceActivity(content,page,options);
 }
 return {browserTitle,title,crumbs};
}
