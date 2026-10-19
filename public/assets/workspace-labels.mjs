import {callApi} from './dashboard-api.mjs';
const cache=new Map();
export function clearWorkspaceLabels(){cache.clear();}
export function workspaceLabels(session,language,options){return settingLabels(session,language,'labelFO',options);}
export function profileLabels(session,language,options){return settingLabels(session,language,'profiles',options);}
async function settingLabels(session,language,group,options){
 const key=session.token+':'+language+':'+group,saved=cache.get(key);
 if(saved&&saved.expires>Date.now())return saved.labels;
 try{
  const first=await callApi(session,language,'/settings/'+group,options),pages=first.context?.pageCount||1;
  if(!Number.isInteger(pages)||pages<1||pages>50)return {};
  const rest=await Promise.all(Array.from({length:pages-1},(_,i)=>callApi(session,language,'/settings/'+group,{...options,query:{page:String(i+2)}})));
  const labels={};for(const result of [first,...rest])for(const [name,value] of Object.entries(result.data||{}))if(Array.isArray(value)&&typeof value[0]==='string')labels[name]=value[0];
  cache.set(key,{labels,expires:Date.now()+300000});return labels;
 }catch(error){if(error.status===401||options?.signal?.aborted)throw error;return {};}
}
