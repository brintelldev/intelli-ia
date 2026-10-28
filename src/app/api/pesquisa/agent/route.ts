import{missingProviderKeys}from'@/lib/provider-availability';import{HttpError}from'@/lib/http-error';
import{maskResearchOutput}from'@/lib/pesquisa/output-mask';
import{restoreResearchIndex}from'@/lib/pesquisa/cached-index';
import type {UsageMetadata} from "@/lib/usage-core";
import { withPresentation } from "@/lib/replay";
import{createUIMessageStream,createUIMessageStreamResponse}from'ai';import{Prisma}from'@/generated/prisma/client';
import{requireRole,errorResponse}from'@/lib/session';import{getModel}from'@/lib/llm';import{getCached,setCached}from'@/lib/cache';import{prisma}from'@/lib/prisma';
import{isMaskingEnabled,assertWithinBudget,track,usageMeta}from'@/lib/usage';import{streamError,step}from'@/lib/stream-steps';import{getUsableTemplate}from'@/lib/templates-store';import{withMandatory}from'@/lib/templates';
import{ResearchBody,researchCacheKey}from'@/lib/pesquisa/request';import{runResearch,DEFAULT_RESEARCH_TEMPLATE,type ResearchMessage,type ResearchPart}from'@/lib/pesquisa/agent';import{searchSources}from'@/lib/pesquisa/sources';import{extract}from'@/lib/pesquisa/search';import{checkRobots}from'@/lib/pesquisa/robots';import{scrape}from'@/lib/pesquisa/scraper';import{indexResearch}from'@/lib/pesquisa/index-research';
type Final=Extract<ResearchPart,{phase:'final'}>;type CachedFinal=Final&{indexedContents?:[string,string][]};
async function livePOST(req:Request){const start=Date.now();try{
 const session=await requireRole(['Admin','Analista']);const parsed=ResearchBody.safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message},{status:400});
 const mask=await isMaskingEnabled(session.role);const input=parsed.data,userId=session.user.id;let template=input.template??null;
 if(!template&&input.templateId){const stored=await getUsableTemplate(input.templateId,userId);if(!stored||stored.module!=='demo2_report')return Response.json({error:'Modelo de relatório não encontrado.'},{status:404});template={sections:stored.sections,format:stored.format};}
 template=withMandatory(template??DEFAULT_RESEARCH_TEMPLATE,'demo2_report');
 const main=await getModel('demo2',{userId,overrideModelId:input.modelId,allowUnconfiguredForCache:true});const key=await researchCacheKey(input.query,input.filter,template,main.modelId,input.queries);
 const cached=!input.confirmQueries?await getCached<CachedFinal>(key):null;
 if(!cached){if(missingProviderKeys(process.env).length===3)throw new HttpError(503,'Nenhum provedor de IA possui chave configurada. Use uma entrada gravada ou fale com o administrador.');await assertWithinBudget(userId,'demo2');}
 const fast=cached?null:await getModel('demo2',{userId,preferFallback:true});
 const save=async(part:Final,model:string)=>{const row=await prisma.researchReport.create({data:{userId,query:input.query,optimizedQueries:part.queries,sources:part.sources as unknown as Prisma.InputJsonValue,report:part.report as unknown as Prisma.InputJsonValue,templateId:input.templateId??null,modelUsed:model,sourceFilter:input.filter}});return{...part,reportId:row.id,modelUsed:model,createdAt:row.createdAt.toISOString()};};
 const stream=createUIMessageStream<ResearchMessage>({onError:streamError,execute:async({writer:rawWriter})=>{const writer={write:(part:Parameters<typeof rawWriter.write>[0])=>rawWriter.write(maskResearchOutput(part,mask))};writer.write({type:'start'});
  if(cached){step(writer,'cache','Resultado recuperado do cache','done',{cacheHit:true,sources:cached.value.sources.length});const{indexedContents,...value}=cached.value;let indexFailed=false;try{await restoreResearchIndex(userId,input.query,value.sources,value.report,indexedContents);}catch{indexFailed=true;step(writer,'index','Relatório pronto; não foi possível indexar as fontes','error');}const part=await save({...value,indexFailed},value.modelUsed??main.modelId);writer.write({type:'data-research',id:'research',data:{...part,cacheHit:true,createdAt:cached.createdAt.toISOString()}});void track({module:'demo2',action:'search_cache_hit',userId,status:'success',durationMs:Date.now()-start,metadata:{cacheHit:true,title:input.query}});return;}
  let mainCall:UsageMetadata|undefined;let indexedContents:[string,string][]=[];try{const r=await runResearch({onUsage:(kind,usage,modelId)=>{const meta=usageMeta(kind==="fast"?fast!.state:main.state,usage,modelId);if(kind==="main")mainCall=meta;else void track({module:"demo2",action:"llm_call",userId,status:"success",metadata:{...meta,parentAction:"web_search"}});},...input,template,writer,models:{main:main.model,fast:fast!.model},settings:main.settings,signal:req.signal,deps:{search:searchSources,robots:checkRobots,extract,scrape},index:(sources,contents,report)=>{indexedContents=[...contents].map(([url,text])=>[url,text.slice(0,60000)]);return indexResearch(userId,input.query,sources,contents,report);}});
   if(r.phase==='final'){const part=await save(r,main.state.activeModelId);await setCached(key,{phase:r.phase,queries:r.queries,sources:r.sources,report:r.report,modelUsed:main.state.activeModelId,indexedContents},'demo2',24);writer.write({type:'data-research',id:'research',data:part});}
   void track({module:'demo2',action:'web_search',userId,status:'success',durationMs:Date.now()-start,metadata:{...mainCall,costUsd:mainCall?.costUsd??0,title:input.query,sourceFilter:input.filter,queriesOnly:r.phase==='queries'}});
  }catch(e){void track({module:'demo2',action:'web_search',userId,status:'error',durationMs:Date.now()-start,metadata:{...mainCall,title:input.query}});throw e;}
 }});return createUIMessageStreamResponse({stream});
 }catch(e){return errorResponse(e);}}

export async function POST(req: Request) { return withPresentation(req, "agent", "demo2", "web_search", livePOST); }
