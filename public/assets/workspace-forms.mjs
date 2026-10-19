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
 const form=node('form','form__skForm'),title=node('h2','mb-4',heading),error=node('p','alert alert-danger');error.hidden=true;error.setAttribute('role','alert');
 const content=node('div'),actions=node('div','sk-form-actions'),cancel=node('button','btn btn-light',text('actionCancel','Annuler')),save=node('button','btn btn-primary',text('actionSave','Enregistrer'));cancel.type='button';cancel.addEventListener('click',()=>dialog.close());save.type='submit';save.disabled=true;actions.append(cancel,save);form.append(title,error,content,actions);dialog.append(close,form);root.append(dialog);dialog.showModal();
 let busy=false;const controls=new Map();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());
 try{
  let managers=[];
  if(fields.PMIds){const response=await callApi(session,language,'/clients/users/list',{signal});if(!Array.isArray(response.data))throw new Error('Liste des utilisateurs indisponible.');managers=response.data.filter(u=>u.role==='project_manager').map(u=>({value:u.id,label:[`${u.firstname||''} ${u.lastname||''}`.trim(),u.email].filter(Boolean).join(' - ')}));}
  if(!dialog.open||signal?.aborted)return;
  for(const [key,definition] of Object.entries(fields)){const field=key==='PMIds'?{...definition,multiple:true,entityList:managers}:definition;const create=name==='PortfolioCreate'||name==='ProjectCreateFromPortfolio';let value=(create?undefined:entity[key])??definition.default??'';if(key==='date')value=String(value).slice(0,10);if(key==='PMIds')value=(create?[]:entity.users||[]).filter(u=>u.role==='project_manager').map(u=>u.id);const control=fieldControl(key,field,value);content.append(control.wrap);controls.set(key,control.input);}save.disabled=false;
 }catch(e){error.textContent=e.message;error.hidden=false;if(e.status===401)onExpired(e.message);}
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||save.disabled||!form.reportValidity())return;busy=true;onSaving(true);save.disabled=cancel.disabled=close.disabled=true;error.hidden=true;
  try{const body=formPayload(name,controls,entity);const create=name==='PortfolioCreate'||name==='ProjectCreateFromPortfolio';const resource=name.startsWith('Portfolio')?'portfolios':name.startsWith('Project')?'projects':'activities';await callApi(session,language,'/'+resource+(create?'':'/'+entity.id),{method:create?'POST':'PUT',json:body,signal});dialog.close();onSaving(false);await onSaved();}
  catch(e){if(dialog.open){error.textContent=e.message;error.hidden=false;if(e.status===401)onExpired(e.message);}}
  finally{busy=false;onSaving(false);save.disabled=cancel.disabled=close.disabled=false;}
 });
}
