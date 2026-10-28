import type{ResearchSource,ResearchReport}from'./agent';
import{indexResearch}from'./index-research';
import{prisma}from'../prisma';
/** Conteúdo do cache é público, mas a cópia indexada sempre pertence ao solicitante. */
export function cachedResearchContents(sources:ResearchSource[],stored:[string,string][]=[]){
 const valid=new Map(stored.filter((r):r is [string,string]=>Array.isArray(r)&&typeof r[0]==='string'&&typeof r[1]==='string'));
 return new Map(sources.filter(s=>s.collected&&s.robotsAllowed).map(s=>[s.url,(valid.get(s.url)??`Texto integral indisponível neste cache legado; apenas resumo público e metadados.\n${s.summary??s.snippet}`).slice(0,60000)]));
}
export async function restoreResearchIndex(userId:string,query:string,sources:ResearchSource[],report:ResearchReport,stored?:[string,string][]){
 const contents=cachedResearchContents(sources,stored);
 // Replay/cache legado não recolhe páginas nem duplica fonte já indexada do próprio usuário.
 if(!stored?.length){for(const source of sources){if(await prisma.documentSource.findFirst({where:{userId,sourceType:'web_research',originUrl:source.url,chunkCount:{gt:0}},select:{id:true}}))contents.delete(source.url);}}
 await indexResearch(userId,query,sources,contents,report);
}
