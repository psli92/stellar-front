import {callApi,ApiError} from './dashboard-api.mjs';
export const node=(tag,cls='',text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const fieldsByForm={PortfolioCreate:['name','context'],PortfolioUpdate:['context'],ProjectCreateFromPortfolio:['name','context','PMIds'],ProjectUpdate:['name','context','PMIds'],ActivityUpdate:['name','date','objectives','description','target','vigilancePoints','generalContext']};
export async function allowedForm(session,language,name,options){
 try{const result=await callApi(session,language,'/forms/'+name,options);const fields=result.context?.form;
  if(!fields||typeof fields!=='object'||Array.isArray(fields)||Object.keys(fields).some(k=>!fieldsByForm[name]?.includes(k)))throw new ApiError('Formulaire incompatible.');
  return fields;
 }catch(error){if(error.status===403||error.status===404)return null;throw error;}
}
export function fieldControl(name,field,value=''){
 const wrap=node('div','sk-field');const id='field-'+name;
 const label=node('label','sk-label',field.label||name);label.htmlFor=id;
 if(field.mandatory)label.append(node('span','sk-label__required',' *'));
 const input=node(field.type==='textarea'?'textarea':field.type==='entityById'?'select':'input',field.type==='entityById'?'form-select':'form-control');input.id=id;input.name=name;input.required=field.mandatory===true;input.disabled=field.readonly===true;wrap.hidden=field.hidden===true;
 if(input.tagName==='INPUT')input.type=field.type==='date'?'date':'text';
 if(input.tagName==='TEXTAREA')input.rows=4;
 if(input.tagName==='SELECT'){input.multiple=field.multiple===true;for(const choice of field.entityList||[]){const option=node('option','',choice.label);option.value=choice.value;option.selected=Array.isArray(value)?value.includes(choice.value):String(value)===String(choice.value);input.append(option);}}
 else input.value=String(value??field.default??'');
 input.placeholder=field.placeholder||'';if(name==='name')input.maxLength=255;
 wrap.append(label,input);if(field.description)wrap.append(node('p','sk-help',field.description));return {wrap,input};
}
export function formPayload(name,controls,entity){
 if(!fieldsByForm[name])throw new Error('Formulaire inconnu.');const body={};
 for(const key of fieldsByForm[name]){const input=controls.get(key);if(!input)continue;body[key]=key==='PMIds'?[...input.selectedOptions].map(o=>Number(o.value)):input.value.trim();}
 if(name==='ProjectCreateFromPortfolio')body.portfolio=entity.id;
 return body;
}
export async function openWorkspaceForm(root,{session,language,name,fields,entity={},labels={},signal,onSaving,onSaved,onExpired}){
 const titles={PortfolioCreate:'Nouveau portefeuille',PortfolioUpdate:'Contexte du portefeuille',ProjectCreateFromPortfolio:'Nouveau projet',ProjectUpdate:'Modifier le projet',ActivityUpdate:'Modifier l’activité'};
 const text=(key,fallback)=>labels[key]||fallback;const headingKey=name==='PortfolioCreate'?'portfolioFormNewTitle':name==='PortfolioUpdate'?'portfolioFormEditTitle':name==='ActivityUpdate'?'activityFormEditTitle':name==='ProjectUpdate'?'projectFormEditTitle':'projectFormNewTitle';const heading=text(headingKey,titles[name]);
 const dialog=node('dialog','detail-dialog workspace-form');dialog.setAttribute('aria-label',heading);
 const close=node('button','btn-close');close.type='button';close.setAttribute('aria-label','Fermer');close.addEventListener('click',()=>dialog.close());
 const form=node('form','form__skForm'),title=node('h2','',heading),error=node('p','alert alert-danger');error.hidden=true;error.setAttribute('role','alert');
 const content=node('div'),actions=node('div','sk-form-actions'),cancel=node('button','btn btn-light',text('actionCancel','Annuler')),save=node('button','btn btn-primary',text('actionSave','Enregistrer'));cancel.type='button';cancel.addEventListener('click',()=>dialog.close());save.type='submit';save.disabled=true;actions.append(cancel,save);const entityName=name.startsWith('Portfolio')?'portfolio':name.startsWith('Project')?'project':'activity';const intro=node('div','mb-4');intro.append(title);const subtitle=text(entityName+'FormSubtitle','');if(subtitle)intro.append(node('p','sk-help mb-0',subtitle));const footer=text(entityName+'FormFooter','');if(footer)content.append(node('p','sk-help mt-2 workspace-form-footer',footer));form.append(intro,error,content,actions);dialog.append(close,form);root.append(dialog);dialog.showModal();
 let busy=false;const controls=new Map();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());
 try{
  let managers=[];
  if(fields.PMIds){const response=await callApi(session,language,'/clients/users/list',{signal});if(!Array.isArray(response.data))throw new Error('Liste des utilisateurs indisponible.');managers=response.data.filter(u=>u.role==='project_manager').map(u=>({value:u.id,label:[`${u.firstname||''} ${u.lastname||''}`.trim(),u.email].filter(Boolean).join(' - ')}));}
  if(!dialog.open||signal?.aborted)return;
  for(const [key,definition] of Object.entries(fields)){const field=key==='PMIds'?{...definition,multiple:true,entityList:managers}:definition;const create=name==='PortfolioCreate'||name==='ProjectCreateFromPortfolio';let value=(create?undefined:entity[key])??definition.default??'';if(key==='date')value=String(value).slice(0,10);if(key==='PMIds')value=(create?[]:entity.users||[]).filter(u=>u.role==='project_manager').map(u=>u.id);const control=fieldControl(key,field,value);content.insertBefore(control.wrap,content.querySelector('.workspace-form-footer'));if(key==='PMIds')searchableUsers(control,field,language);controls.set(key,control.input);}save.disabled=false;
 }catch(e){error.textContent=e.message;error.hidden=false;if(e.status===401)onExpired(e.message);}
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||save.disabled||!form.reportValidity())return;busy=true;onSaving(true);save.disabled=cancel.disabled=close.disabled=true;error.hidden=true;
  try{const body=formPayload(name,controls,entity);const create=name==='PortfolioCreate'||name==='ProjectCreateFromPortfolio';const resource=name.startsWith('Portfolio')?'portfolios':name.startsWith('Project')?'projects':'activities';await callApi(session,language,'/'+resource+(create?'':'/'+entity.id),{method:create?'POST':'PUT',json:body,signal});dialog.close();onSaving(false);await onSaved();}
  catch(e){if(dialog.open){error.textContent=e.message;error.hidden=false;if(e.status===401)onExpired(e.message);}}
  finally{busy=false;onSaving(false);save.disabled=cancel.disabled=close.disabled=false;}
 });
}

function searchableUsers({wrap,input},field,language){
 const french=language==='FR',box=node('div','workspace-user-picker form-control'),chips=node('div','workspace-user-chips'),search=node('input','workspace-user-search'),list=node('div','workspace-user-results');
 input.hidden=true;input.tabIndex=-1;search.type='search';search.id=input.id+'-search';search.autocomplete='off';search.placeholder=field.placeholder||(french?'Rechercher un utilisateur…':'Search users…');search.setAttribute('aria-label',search.placeholder);search.disabled=input.disabled;wrap.querySelector('label').htmlFor=search.id;
 search.setAttribute('role','combobox');search.setAttribute('aria-autocomplete','list');search.setAttribute('aria-expanded','false');list.id=input.id+'-results';list.setAttribute('role','listbox');list.setAttribute('aria-label',field.label||'Utilisateurs');search.setAttribute('aria-controls',list.id);list.hidden=true;let active=-1;
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function close(){list.hidden=true;active=-1;search.setAttribute('aria-expanded','false');search.removeAttribute('aria-activedescendant');}
 function choose(option){option.selected=true;input.dispatchEvent(new Event('change',{bubbles:true}));search.value='';render();results();search.focus();}
 function render(){chips.replaceChildren();for(const option of input.selectedOptions){const chip=node('span','workspace-user-chip'),remove=node('button','', '×');remove.type='button';remove.disabled=input.disabled;remove.setAttribute('aria-label',(french?'Retirer ':'Remove ')+option.textContent);remove.addEventListener('click',()=>{option.selected=false;input.dispatchEvent(new Event('change',{bubbles:true}));render();results();search.focus();});chip.append(remove,document.createTextNode(option.textContent));chips.append(chip);}}
 function results(){list.replaceChildren();active=-1;search.removeAttribute('aria-activedescendant');const choices=[...input.options].filter(o=>!o.selected&&normalize(o.textContent).includes(normalize(search.value)));for(const [index,option] of choices.entries()){const row=node('div','workspace-user-option',option.textContent);row.id=list.id+'-'+index;row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.addEventListener('mousedown',e=>e.preventDefault());row.addEventListener('click',()=>choose(option));row._choose=()=>choose(option);list.append(row);}if(!choices.length)list.append(node('div','workspace-user-empty',french?'Aucun résultat':'No results'));list.hidden=false;search.setAttribute('aria-expanded','true');}
 search.addEventListener('input',results);search.addEventListener('focus',results);search.addEventListener('keydown',event=>{if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();close();return;}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(list.hidden)results();const rows=[...list.querySelectorAll('[role=option]')];if(!rows.length)return;active=(active+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows.forEach((row,i)=>row.setAttribute('aria-selected',String(i===active)));search.setAttribute('aria-activedescendant',rows[active].id);rows[active].scrollIntoView({block:'nearest'});}if(event.key==='Enter'){event.preventDefault();list.querySelectorAll('[role=option]')[active<0?0:active]?._choose();}});
 const holder=node('div','workspace-user-control');holder.addEventListener('focusout',()=>setTimeout(()=>{if(!holder.contains(document.activeElement))close();},0));input.addEventListener('change',render);box.append(chips,search);holder.append(box,list);input.after(holder);render();
}
