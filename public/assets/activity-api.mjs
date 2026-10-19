import {callApi,ApiError} from './dashboard-api.mjs';
export const activityPath=path=>/^\/activity\/[1-9]\d*\/(?:axes\/[1-9]\d*|narrative\/(?:analysis|parameters|history|result))$/.test(path.split('?')[0]);
export const activityRequest=(session,language,path,options={})=>callApi(session,language,path,{timeoutMs:180000,serverMessage:true,...options});
export async function optionalRead(request,path,options){try{return await request(path,options);}catch(error){if(error.status===401||options?.signal?.aborted)throw error;return {data:null,error};}}
export async function loadActivityExtras(activity,session,language,signal){const request=(path,opts)=>activityRequest(session,language,path,{signal,...opts});const [contributions,history,tag]=await Promise.all([
 optionalRead(request,'/contributions',{query:{activityId:activity.id,scope:'activity'},signal}),optionalRead(request,'/deliverable-requests',{query:{activity:activity.id},signal}),optionalRead(request,'/activities/'+activity.id+'/tags/user',{signal})]);
 for(const result of [contributions,history])if(!result.error&&!Array.isArray(result.data))throw new ApiError('Réponse métier incomplète.');return {contributions,history,tag};}
export async function uploadAudio(session,language,file,signal){if(!file||file.size===0)throw new ApiError('Sélectionnez un fichier audio ou vidéo non vide.');if(file.size>50*1024*1024)throw new ApiError('Le fichier dépasse 50 Mo.');if(!/^(audio|video)\//.test(file.type)&&! /\.(mp3|wav|webm|ogg|m4a|mp4|mov|flac|aac)$/i.test(file.name))throw new ApiError('Format audio ou vidéo non pris en charge.');
 const data=new FormData();data.append('file',file);for(const [key,value] of Object.entries({title:file.name,alt:file.name,job:'0',folder:'audios',prefix:'workspace_audios'}))data.append(key,value);
 const result=await activityRequest(session,language,'/assets',{method:'POST',formData:data,signal,timeoutMs:900000});if(typeof result.data?.key!=='string')throw new ApiError('Import non confirmé.');return result.data.key;}
export function contributionIds(rows){return rows.filter(c=>c.type!=='asset'&&!c.isExcluded).map(c=>c.id);}
const memory=new Map();
// Only selected numeric ids are persisted. No contribution contents or service credentials.
function selectionKey(session,id){try{const p=JSON.parse(atob(session.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return 'stellar:selection:'+encodeURIComponent((p.scope||'app')+':'+p.sub+':'+p.sid)+':'+id;}catch{return 'stellar:selection:temporary:'+id;}}
export function selection(session,id,rows,next){const key=selectionKey(session,id);if(next){memory.set(key,next);try{sessionStorage.setItem(key,JSON.stringify(next));}catch{}}let values=memory.get(key);if(!values)try{values=JSON.parse(sessionStorage.getItem(key)||'[]');}catch{}const valid=new Set(contributionIds(rows));return (Array.isArray(values)?values:[]).filter(n=>Number.isSafeInteger(n)&&valid.has(n));}
export function clearActivitySelections(){memory.clear();try{for(const key of Object.keys(sessionStorage))if(key.startsWith('stellar:selection:'))sessionStorage.removeItem(key);}catch{}}
