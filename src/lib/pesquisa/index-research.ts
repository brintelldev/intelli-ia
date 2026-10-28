import {createHash} from 'node:crypto';
import {embedBatch} from '@/lib/embeddings';import {prisma} from '@/lib/prisma';import {chunkDocument} from '@/lib/pdf/chunker';import {buildDocument} from '@/lib/pdf/document';import {insertChunks} from '@/lib/vector-store';
import type {ResearchSource,ResearchReport} from './agent';
/** Fontes coletadas e relatório são privados de quem pediu a pesquisa. */
export async function indexResearch(userId:string,query:string,sources:ResearchSource[],contents:Map<string,string>,report:ResearchReport){
 const items=[...sources.filter(s=>contents.has(s.url)).map(s=>({filename:s.title,originUrl:s.url,text:contents.get(s.url)!,category:s.category??'Fontes públicas',topics:s.topics??[],summary:s.summary??s.snippet})),{filename:`Relatório — ${query.slice(0,120)}`,originUrl:null,text:report.sections.map(s=>`${s.heading}\n${s.content}`).join('\n\n'),category:'Relatórios de pesquisa',topics:[query.slice(0,80)],summary:report.sections[0]?.content.slice(0,500)??''}];
 for(const item of items){const text=item.text.slice(0,60000),chunks=chunkDocument(buildDocument(text));if(!chunks.length)continue;
 const id=`research-${createHash('sha256').update(JSON.stringify([userId,item.originUrl,item.filename,text])).digest('hex').slice(0,32)}`;
 const existing=await prisma.documentSource.findUnique({where:{id}});
 if(existing&&existing.chunkCount===chunks.length&&await prisma.documentChunk.count({where:{sourceId:id,userId}})===chunks.length)continue;
 const vectors=await embedBatch(chunks.map(c=>c.content));
 const data={userId,filename:item.filename.slice(0,250),sourceType:'web_research',originUrl:item.originUrl,category:item.category,topics:item.topics,summary:item.summary.slice(0,500),chunkCount:chunks.length};
 await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
  await tx.documentSource.upsert({where:{id},create:{id,...data},update:{...data,createdAt:new Date()}});
  await tx.$executeRaw`DELETE FROM document_chunks WHERE source_id=${id}`;
  await insertChunks(chunks.map((c,i)=>({sourceId:id,sourceType:'web_research',userId,content:c.content,embedding:vectors[i],metadata:{...c.metadata,filename:item.filename}})),tx);
 });
 }
}
