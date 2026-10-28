import {cacheKey} from '@/lib/cache';
import {prisma} from '@/lib/prisma';
import {getAccessScope,sourceAccessWhere,scopeFingerprint} from '@/lib/access';
import {sessionMessages} from '@/lib/chat/history';
import {lastUserText,ChatBody} from '@/lib/chat/rag-core';
import {AnalyzeBody} from '@/lib/documentos/analysis';
import {BriefBody} from '@/lib/documentos/brief';
import {SuggestBody} from '@/lib/documentos/keywords';
import {SummaryBody} from '@/lib/documentos/summary';
import {ResearchBody} from '@/lib/pesquisa/request';
import {IngestBody} from '@/lib/chat/ingest-core';
import {isMaskingEnabled} from '@/lib/usage';
import {HttpError} from '@/lib/http-error';
import type {Role} from '@/lib/rbac';
import type {z} from 'zod';
const SCHEMAS={'analyze':AnalyzeBody,'generate-brief':BriefBody,'suggest-keywords':SuggestBody,'summary':SummaryBody,'agent':ResearchBody,'chat':ChatBody,'ingest':IngestBody};
export type ReplayRoute=keyof typeof SCHEMAS;
type Actor={userId:string;role:Role};
type History={role:string;parts:{type:string;text?:string}[]}[];
const keyOf=(route:ReplayRoute,actor:Actor,identity:unknown,context:unknown)=>cacheKey(['replay-v1',actor.userId,route,JSON.stringify(identity),JSON.stringify(context)]);
/** A mesma função prepara a chave de uma conversa nova no verificador do roteiro, sem criar sessão. */
export async function chatReplayKey(body:z.infer<typeof ChatBody>,actor:Actor,history:History,report:unknown){
 const access=await getAccessScope(actor.userId,actor.role);
 const sources=await prisma.documentSource.findMany({where:{AND:[sourceAccessWhere(access),...(body.sourceId?[{id:body.sourceId}]:body.sourceFilter!=='all'?[{sourceType:body.sourceFilter}]:[])]},orderBy:{id:'asc'},select:{id:true,createdAt:true,chunkCount:true}});
 if(body.sourceId&&!sources.some(s=>s.id===body.sourceId))throw new HttpError(404,'Fonte indisponível.');
 const identity={question:lastUserText(body.messages),sourceFilter:body.sourceFilter,sourceId:body.sourceId??null,collectionKind:body.collectionKind??null,modelId:body.modelId??null};
 const context={mask:await isMaskingEnabled(actor.role),role:actor.role,scope:scopeFingerprint(access),sources,history:history.slice(-10).map(m=>({role:m.role,parts:m.parts.filter(p=>p.type==='text')})),report};
 return keyOf('chat',actor,identity,context);
}
export async function replayRequest(route:ReplayRoute,raw:unknown,actor:Actor){
 const parsed=SCHEMAS[route].safeParse(raw);
 if(!parsed.success)throw new HttpError(400,parsed.error.issues[0]?.message??'Entrada inválida.');
 const input=parsed.data as Record<string,unknown>;
 let identity:unknown=input;
 let context:unknown={mask:await isMaskingEnabled(actor.role),role:actor.role};
 if(typeof input.templateId==='string'){
  const t=await prisma.reportTemplate.findFirst({where:{id:input.templateId,OR:[{ownerId:null},{ownerId:actor.userId}]}});
  if(!t)throw new HttpError(404,'Modelo de seções não encontrado.');
  context={...context as object,template:t};
 }
 if(route==='chat'){
  const body=ChatBody.parse(input);
  const session=await prisma.chatSession.findFirst({where:{id:body.id,userId:actor.userId}});
  if(!session)throw new HttpError(404,'Conversa não encontrada.');
  const history=await sessionMessages(body.id,actor.userId,actor.role);
  const report=session.threadId?await prisma.researchReport.findFirst({where:{id:session.threadId,userId:actor.userId},select:{query:true,report:true}}):null;
  return{input,key:await chatReplayKey(body,actor,history,report),baseline:history.map(m=>m.id)};
 }
 if(route==='ingest'&&typeof input.sessionId==='string'){
  if(!await prisma.chatSession.findFirst({where:{id:input.sessionId,userId:actor.userId}}))throw new HttpError(404,'Conversa não encontrada.');
  identity={...input,sessionId:undefined};
 }
 return{input,key:keyOf(route,actor,identity,context),baseline:[] as string[]};
}
