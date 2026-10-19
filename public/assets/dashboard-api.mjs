export class ApiError extends Error { constructor(message,status=0,code=''){super(message);this.status=status;this.code=String(code);} }
export async function callApi(session,language,path,{method='GET',signal,fetcher=fetch,json,query}={}) {
 if(!/^[A-Za-z]{2,3}$/.test(language)||!/^\/[a-z0-9/-]+$/i.test(path))throw new ApiError('Requête invalide.');
 const timeout=AbortSignal.timeout(20000);const combined=signal?AbortSignal.any([signal,timeout]):timeout;
 let response,body;
 try{response=await fetcher('/api/'+language.toUpperCase()+path+(query?'?'+new URLSearchParams(query):''),{method,headers:{Accept:'application/json',Authorization:'Bearer '+session.token,...(json===undefined?{}:{'Content-Type':'application/json'})},...(json===undefined?{}:{body:JSON.stringify(json)}),credentials:'omit',cache:'no-store',signal:combined});body=await response.json();}
 catch(error){if(signal?.aborted)throw error;throw new ApiError('Le service est momentanément indisponible.');}
 if(!response.ok||String(body.code)!=='0'){
  const message=response.status===401?'Votre session a expiré.':String(body.code)==='-3000'?'Veuillez accepter les conditions générales sur le front actuel avant de continuer.':response.status===403?'Vous ne disposez pas des droits nécessaires.':response.status===409?'Un élément porte déjà ce nom.':method!=='GET'?'Enregistrement refusé. Vérifiez les champs et vos droits.':'Impossible de charger ces données. Réessayez.';
  throw new ApiError(message,response.status,body.code);
 }
 return body;
}
export function validContext(context){return context&&typeof context.canSwitch==='boolean'&&Array.isArray(context.clients)&&context.clients.every(c=>Number.isSafeInteger(c.id)&&c.id>0&&typeof c.name==='string')&&(context.current===null||context.clients.some(c=>c.id===context.current?.id));}
export async function loadDashboard(session,language,options){
 const result=await callApi(session,language,'/dashboard',options);
 if(!['portfolios','projects','activities','oneShots'].every(k=>Array.isArray(result.data?.[k])&&result.data[k].every(i=>Number.isSafeInteger(i.id)&&i.id>0&&typeof i.name==='string'))||!validContext(result.context?.clientContext))throw new ApiError('Réponse dashboard incomplète. Vérifiez la version de Stellar.');
 return result;
}
export async function switchClient(session,language,id,options){
 if(!Number.isSafeInteger(id)||id<1)throw new ApiError('Client invalide.');
 const result=await callApi(session,language,'/clients/'+id+'/switch',{...options,method:'PUT'});
 if(!validContext(result.data)||result.data.current?.id!==id)throw new ApiError('Changement de client non confirmé.');
 return result.data;
}
export function formatDate(value,language='FR'){
 if(!value)return '';
 let iso=typeof value==='string'?value:value.date;
 if(typeof iso!=='string')return '';
 if(typeof value==='object'){
  if(value.timezone!=='UTC')return ''; // Legacy dashboard dates are UTC, never browser-local input.
  iso=iso.replace(' ','T').replace(/\.\d+$/,'')+'Z';
 }
 const date=new Date(iso);if(Number.isNaN(date.getTime()))return '';
 return new Intl.DateTimeFormat(language.toLowerCase(),{dateStyle:'long',timeZone:'Europe/Paris'}).format(date);
}

export function formatCount(count,singular,plural,labels={}){const key=count>1?plural:singular;const defaults={project:"projet",projects:"projets",activity:"activité",activities:"activités"};return count+" "+(labels[key]||defaults[key]||key);}
