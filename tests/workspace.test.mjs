import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspacePath,loadWorkspace,workspaceBrowserTitle} from '../public/assets/workspace-pages.mjs';
import {formPayload,allowedForm} from '../public/assets/workspace-forms.mjs';
import {clearWorkspaceLabels} from '../public/assets/workspace-labels.mjs';
test('workspace paths and membership guard prevent cross-client project/activity reads',async()=>{
 assert.equal(workspacePath('/portfolios/2/projects/10/activity/form'),true);
 assert.equal(workspacePath('/activities/../../admin'),false);
 const calls=[];const fetcher=async url=>{calls.push(url);return {ok:true,json:async()=>({code:0,data:[]})};};
 await assert.rejects(loadWorkspace({token:'x'},'FR','/projects/10',{fetcher}),e=>e.status===404);
 assert.deepEqual(calls,['/api/FR/projects']);
});
test('form payloads are strictly scoped to the write contract',()=>{
 const controls=new Map([['name',{value:' New '}],['context',{value:' context '}],['PMIds',{selectedOptions:[{value:'10'}]}],['workingLanguage',{value:'FR'}]]);
 assert.deepEqual(formPayload('PortfolioUpdate',controls,{id:2}),{context:'context'});
 assert.deepEqual(formPayload('ProjectCreateFromPortfolio',controls,{id:2}),{name:'New',context:'context',PMIds:[10],portfolio:2});
 assert.deepEqual(formPayload('ActivityUpdate',controls,{id:3}),{name:'New'});
});
test('denied forms are not capabilities; authorization failures propagate',async()=>{
 const denied=status=>({fetcher:async()=>({ok:false,status,json:async()=>({code:status})})});
 assert.equal(await allowedForm({token:'x'},'FR','PortfolioCreate',denied(403)),null);
 await assert.rejects(allowedForm({token:'x'},'FR','PortfolioCreate',denied(401)),e=>e.status===401);
 clearWorkspaceLabels();
});

test('browser title blocks follow the original Twig templates and translated activity type',()=>{
 const labels={'ActivityType.TransformationNarrative.title':'Narratif de transformation',portfolioDetailTitle:'Détail du portefeuille',NarrativeResultTitle:'Résultat',axe_page_title:'Contributions'};
 const page={kind:'activities',data:{name:'Atelier 1',type:{name:'TransformationNarrative'}}};
 assert.equal(workspaceBrowserTitle(page,labels),'Atelier 1 - Narratif de transformation');
 assert.equal(workspaceBrowserTitle({...page,special:true,mode:'result'},labels),'Atelier 1 - Résultat');
 assert.equal(workspaceBrowserTitle({...page,special:true,mode:'axis'},labels),'Contributions');
 assert.equal(workspaceBrowserTitle({kind:'portfolios',data:{name:'Stellar'}},labels),'Stellar - Détail du portefeuille');
});
