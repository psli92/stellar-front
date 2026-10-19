import {test} from 'node:test';
import assert from 'node:assert/strict';
import {login,readSession,clearSession} from '../public/assets/auth.mjs';
const now=1700000000000;
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:now/1000+300})).toString('base64url')+'.synthetic';
const response={token,refresh_token:'never-store-refresh',profile:'bo_webmaster',firstname:'Test',lastname:'User',defaultLanguage:'FR',extra:{consent:true,clientContext:{current:{name:'Client'}}}};
function memory(){const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),values:()=>[...m.values()]};}
test('uses Stellar raw alias and preserves password; stores user session only per tab',async()=>{
 const storage=memory();let calls=0;
 const result=await login({username:' TEST@Example.COM ',password:' secret ',language:'en',storage,now,fetcher:async(url,options)=>{
  calls++;assert.equal(url,'/api/EN/login_check');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,undefined);
  assert.deepEqual(JSON.parse(options.body),{username:'test@example.com',password:' secret '});
  return {ok:true,status:200,json:async()=>response};
 }});
 assert.equal(calls,1);assert.equal(result.persisted,true);assert.equal(readSession(storage,now).firstname,'Test');
 assert.ok(!storage.values()[0].includes('never-store-refresh'));assert.ok(!storage.values()[0].includes(' secret '));
 assert.equal(readSession(storage,now+301000),null);assert.equal(storage.values().length,0);
});
test('denials, partial success, anonymous, expired token, password change and MFA never open a session',async()=>{
 for(const item of [
  {status:401,body:{message:'private detail'}},{status:429,body:{}},{status:503,body:{}},
  {status:200,body:{code:'0',data:response}}, {status:200,body:{...response,profile:'anonymous'}},
  {status:200,body:{...response,must_change_password:true}}, {status:200,body:{mfa_required:true}},
  {status:200,body:{...response,token:'invalid'}},
 ]){
  const storage=memory();await assert.rejects(login({username:'user',password:'pw',storage,now,fetcher:async()=>({ok:item.status===200,status:item.status,json:async()=>item.body})}));
  assert.equal(storage.values().length,0);
 }
});
test('network errors are sanitized; unavailable storage permits in-memory login; clear is safe',async()=>{
 await assert.rejects(login({username:'user',password:'pw',now,fetcher:async()=>{throw Error('password=private');}}),e=>!e.message.includes('private'));
 const storage={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};
 const result=await login({username:'user',password:'pw',now,storage,fetcher:async()=>({ok:true,status:200,json:async()=>response})});
 assert.equal(result.persisted,false);assert.equal(result.session.token,token);clearSession(storage);assert.equal(readSession(storage,now),null);
});
