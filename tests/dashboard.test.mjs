import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadDashboard,switchClient,formatDate,callApi} from '../public/assets/dashboard-api.mjs';
const context={canSwitch:true,current:{id:2,name:'Client B'},clients:[{id:1,name:'A'},{id:2,name:'Client B'}]};
test('dashboard uses caller token and server-selected context; switching is PUT without injected client filters',async()=>{
 const session={token:'caller.token'};const fetcher=async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer caller.token');assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');if(url.endsWith('/switch')){assert.equal(url,'/api/FR/clients/2/switch');assert.equal(options.method,'PUT');assert.equal(options.body,undefined);return{ok:true,json:async()=>({code:0,data:context})};}assert.equal(url,'/api/FR/dashboard');return{ok:true,json:async()=>({code:0,context:{clientContext:context},data:{portfolios:[],projects:[],activities:[],oneShots:[]}})};};
 assert.equal((await loadDashboard(session,'FR',{fetcher})).context.clientContext.current.id,2);assert.equal((await switchClient(session,'FR',2,{fetcher})).current.id,2);
 await assert.rejects(switchClient(session,'FR',-1,{fetcher}));
});
test('permissions and CGU errors are preserved and malformed success is rejected',async()=>{
 for(const [status,code] of [[401,'-1'],[403,'-3000'],[403,'-2'],[503,'-3']])await assert.rejects(callApi({token:'x'},'FR','/dashboard',{fetcher:async()=>({ok:false,status,json:async()=>({code,message:'private'})})}),e=>e.status===status&&e.code===code&&!e.message.includes('private'));
 await assert.rejects(loadDashboard({token:'x'},'FR',{fetcher:async()=>({ok:true,json:async()=>({code:0,data:{}})})}));
 assert.equal(formatDate({date:'2026-10-02 23:30:00.000000',timezone:'UTC'},'FR'),'03/10/2026');assert.equal(formatDate({date:'invalid',timezone:'UTC'}),'');
});
