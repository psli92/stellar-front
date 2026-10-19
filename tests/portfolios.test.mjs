import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPortfolios,portfolioPath} from '../public/assets/portfolios.mjs';
const session={token:'user-token'},item={id:8,name:'Portfolio',projects:[{id:9,name:'Project',activities:[]}]};
test('portfolio reads use caller identity, server-scoped list and validate deep links',async()=>{
 const paths=[];const fetcher=async(path,options)=>{paths.push(path);assert.equal(options.headers.Authorization,'Bearer user-token');assert.equal(options.cache,'no-store');return {ok:true,json:async()=>({code:0,data:path.endsWith('/8')?item:[item]})};};
 assert.deepEqual(await loadPortfolios(session,'FR','/portfolios/8',{fetcher}),item);
 assert.deepEqual(paths,['/api/FR/portfolios','/api/FR/portfolios/8']);
 paths.length=0;
 await assert.rejects(loadPortfolios(session,'FR','/portfolios/99',{fetcher}),e=>e.status===404);
 assert.deepEqual(paths,['/api/FR/portfolios']);
 assert.equal(portfolioPath('/portfolios/8'),true);assert.equal(portfolioPath('/portfolios/8?client=4'),false);
});
test('empty, invalid and denied portfolio responses are not rendered as successful data',async()=>{
 const result=data=>({fetcher:async()=>({ok:true,json:async()=>({code:0,data})})});
 assert.deepEqual(await loadPortfolios(session,'FR','/portfolios',result([])),[]);
 await assert.rejects(loadPortfolios(session,'FR','/portfolios',result({})),/incomplète/);
 await assert.rejects(loadPortfolios(session,'FR','/portfolios',{fetcher:async()=>({ok:false,status:403,json:async()=>({code:-1})})}),e=>e.status===403);
});
