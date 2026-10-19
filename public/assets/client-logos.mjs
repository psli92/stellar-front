// Private images are fetched with the caller token, never a token in an image URL.
export function clientLogos(session,language){
 const controller=new AbortController(),urls=[],pending=new Map();
 const configured=document.querySelector('meta[name="sk-api-root"]')?.content||'v1';
 const root=/^[A-Za-z0-9_-]+$/.test(configured)?configured:'v1';
 async function load(key){
  const response=await fetch('/api/'+root+'/'+language+'/assets/'+key,{headers:{Authorization:'Bearer '+session.token},credentials:'omit',cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
  if(!response.ok||!/^image\//i.test(response.headers.get('Content-Type')||''))throw Error('Logo unavailable');
  const blob=await response.blob();if(controller.signal.aborted)throw Error('Closed');
  const url=URL.createObjectURL(blob);urls.push(url);return url;
 }
 return {decorate(node,client){const key=client?.logoSmallKey;if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(key||''))return;
  if(!pending.has(key))pending.set(key,load(key));
  pending.get(key).then(url=>{if(controller.signal.aborted||!node.isConnected)return;const img=document.createElement('img');img.className='client-avatar__img';img.alt=client.name;img.width=28;img.height=28;img.onload=()=>{if(!controller.signal.aborted){node.replaceChildren(img);node.classList.remove('client-avatar--placeholder');}};img.src=url;}).catch(()=>{});
 },close(){controller.abort();for(const url of urls)URL.revokeObjectURL(url);}};
}
