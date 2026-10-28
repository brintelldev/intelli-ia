import {prisma} from '../src/lib/prisma';
import {loadScenario,resolveInput,responseValue} from './lib/demo-scenario';
import {recordingValid} from '../src/lib/replay/core';
import {replayRequest,chatReplayKey} from '../src/lib/replay/request';
import {ChatBody} from '../src/lib/chat/rag-core';
import type {StoredReplay} from '../src/lib/replay';
async function main(){
 const {manifest,digest,document}=await loadScenario();
 const user=await prisma.user.findUnique({where:{email:process.env.DEMO_EMAIL||'analista@intellisuite.com'}});
 if(!user||!['Admin','Analista'].includes(user.role??''))throw Error('Conta do roteiro sem acesso de execução.');
 const actor={userId:user.id,role:user.role as 'Admin'|'Analista'};
 const rows=await prisma.responseCache.findMany({where:{module:'replay',response:{path:['userId'],equals:user.id}},orderBy:{createdAt:'desc'}});
 const values:Record<string,unknown>={document,session:{id:'new-conversation-preview'}};
 let missing=0;
 for(const step of manifest.steps){
  const candidates=rows.filter(r=>{const v=r.response as unknown as StoredReplay;return v.route===step.route&&v.scenarioStep===step.id&&v.scenarioDigest===digest&&recordingValid(v);});
  let found:typeof rows[number]|undefined;
  try{const input=resolveInput(step.body,values) as Record<string,unknown>;const key=step.route==='chat'?await chatReplayKey(ChatBody.parse(input),actor,[],null):(await replayRequest(step.route,input,actor)).key;found=candidates.find(r=>r.cacheKey===key);}catch{/* falta uma entrada anterior ou o acesso mudou */}
  console.log(`${found?'OK':'FALTA'} ${step.id}`);
  if(!found)missing++;
  const candidate=found??candidates[0];if(candidate){const v=candidate.response as unknown as StoredReplay;values[step.id]=responseValue(v.body,v.contentType);}
 }
 console.log(`${manifest.steps.length-missing}/${manifest.steps.length} etapas com chave, conta, entrada e contexto atuais. Regrave após mudar entradas ou acesso.`);
 if(missing)process.exitCode=1;
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Falha ao verificar gravações');process.exitCode=1;}).finally(()=>prisma.$disconnect());
