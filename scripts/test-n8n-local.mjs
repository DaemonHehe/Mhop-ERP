import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const apiBase=new URL(process.env.N8N_API_URL || 'http://localhost:5678/api/v1');
const base=apiBase.origin;
const workflowId=process.env.N8N_WORKFLOW_ID || 'sinlB8NbcPfUqRb7';
const key=process.env.N8N_API_KEY;
if (!key) throw new Error('N8N_API_KEY is required');
async function api(method,path,body) {
 const r=await fetch(base+'/api/v1'+path,{method,headers:{'X-N8N-API-KEY':key,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 if (!r.ok) throw new Error(`${method} ${path}: HTTP ${r.status}`);
 return r.json();
}
const live=await api('GET','/workflows/'+encodeURIComponent(workflowId));
const source=name=>structuredClone(live.nodes.find(n=>n.name===name));
const slug='mhop-isolated-test-'+randomUUID();
const nodes=[{id:'trigger',name:'Isolated Test',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],webhookId:slug,parameters:{httpMethod:'POST',path:slug,authentication:'none',responseMode:'lastNode',options:{}}}];
for (const [index,name] of ['Fetch Daily Briefing', 'Fetch Financial Digest'].entries()) {
 const node=source(name);node.id='read-'+index;node.position=[(index+1)*220,0];node.alwaysOutputData=true;nodes.push(node);
}
nodes.push({id:'result',name:'Verify Results',type:'n8n-nodes-base.code',typeVersion:2,position:[660,0],parameters:{mode:'runOnceForAllItems',jsCode:"const stats=$('Fetch Daily Briefing').first().json; if(!('revenue' in stats)) throw new Error('Daily stats response is invalid'); return [{json:{ok:true,statsFetched:true,telegramMessagesSent:0}}];"}});
const connections={};for(let i=0;i<nodes.length-1;i++) connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};
let created;
try {
 created=await api('POST','/workflows',{name:'MH OP isolated connection test '+slug.slice(-8),nodes,connections,settings:{executionOrder:'v1',executionTimeout:90,saveDataErrorExecution:'all',saveDataSuccessExecution:'all',timezone:'Asia/Yangon'}});
 console.log(JSON.stringify({temporaryWorkflowId:created.id,sourceActive:live.active}));
 await api('POST',`/workflows/${created.id}/activate`,{});
 const result=await fetch(base+'/webhook/'+slug,{method:'POST',headers:{authorization:'Bearer '+process.env.ADMIN_API_TOKEN,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(100000)});
 const payload=await result.json().catch(()=>({error:'Non-JSON test response'}));
 console.log(JSON.stringify({httpStatus:result.status,result:payload}));
 const executions=await api('GET',`/executions?workflowId=${created.id}&limit=1`);
 const id=executions.data?.[0]?.id;
 let detail;if(id) detail=await api('GET',`/executions/${id}?includeData=true`);
 const error=detail?.data?.resultData?.error;
 const report={at:new Date().toISOString(),sourceWorkflow:live.id,sourceActive:live.active,temporaryWorkflow:created.id,executionId:id,status:detail?.status,httpStatus:result.status,result:payload,error:error?{message:error.message,node:error.node?.name}:undefined};
 await mkdir('.local/n8n-tests',{recursive:true});await writeFile('.local/n8n-tests/latest.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({executionId:id,status:detail?.status,error:report.error}));
 if(detail?.status!=='success' || !payload.ok) process.exitCode=1;
} finally {
 if(created){await api('POST',`/workflows/${created.id}/deactivate`,{});await api('DELETE',`/workflows/${created.id}`);console.log('Temporary test workflow removed; master workflow activation unchanged.');}
}
