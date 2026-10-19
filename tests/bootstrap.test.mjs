import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadBootstrap} from '../public/assets/bootstrap.mjs';

const data = {language:'FR',languages:[{code:'FR',label:'Français'}],labels:{AppTitle:'Stellar'},branding:null,cacheTtl:300,revision:'a'.repeat(64)};
test('public bootstrap uses same origin, no credentials, bounded session cache and language/client separation', async () => {
  const values = new Map(); const storage = {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  let calls = 0; let time = 1000;
  const fetcher = async (url, options) => {calls++; assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,undefined);assert.ok(url.startsWith('/api/FR/public/bootstrap'));return {ok:true,json:async()=>({code:0,data})};};
  const opts={storage,fetcher,now:()=>time};
  assert.deepEqual(await loadBootstrap(opts),data);
  await loadBootstrap(opts); assert.equal(calls,1);
  time+=300001; await loadBootstrap(opts); assert.equal(calls,2);
  await loadBootstrap({...opts,client:'cnes'}); assert.equal(calls,3);
  await loadBootstrap({...opts,force:true}); assert.equal(calls,4);
});
test('disabled storage is optional; malformed/failed responses never cached; parameter injection rejected', async () => {
  const storage={getItem:()=>{throw Error();},setItem:()=>{throw Error();}};
  assert.deepEqual(await loadBootstrap({storage,fetcher:async()=>({ok:true,json:async()=>({code:'0',data})})}),data);
  await assert.rejects(loadBootstrap({client:'../groups/app',fetcher:()=>assert.fail('No fetch allowed')}));
  for (const body of [{code:-503,data:null},{code:0,data:{...data,cacheTtl:3600}},{code:0,data:{...data,labels:{AppTitle:{password:'secret'}}}}]) {
    await assert.rejects(loadBootstrap({storage:{setItem:()=>assert.fail('No cache on failure')},fetcher:async()=>({ok:true,json:async()=>body})}));
  }
});
