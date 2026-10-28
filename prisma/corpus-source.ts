import{createHash}from'node:crypto';
import{prisma}from'../src/lib/prisma';
import{embedBatch}from'../src/lib/embeddings';
import{chunkDocument}from'../src/lib/pdf/chunker';
import{buildDocument}from'../src/lib/pdf/document';
import{insertChunks}from'../src/lib/vector-store';
export type CorpusSource={collectionId:string;title:string;url:string;topics:string[];text:string;markdown?:string;license?:string;provenance?:{edition:string;fetchedAt:string;rawSha256:string;textSha256:string;robotsAllowed:boolean}};
export const corpusSourceId=(doc:Pick<CorpusSource,'collectionId'|'title'>)=>`corpus-${createHash('sha256').update(doc.collectionId+doc.title).digest('hex').slice(0,24)}`;
export async function addCorpusSource(doc:CorpusSource,userId:string,embed:typeof embedBatch=embedBatch):Promise<'created'|'existing'|'repaired'>{
 const id=corpusSourceId(doc),chunks=chunkDocument(buildDocument(doc.markdown??doc.text));
 if(!chunks.length)throw Error('Documento sem trechos');
 const source=await prisma.documentSource.findUnique({where:{id}});
 const rows=await prisma.$queryRaw<{content:string;metadata:{textSha256?:string;index:number;startPage:number}}[]>`SELECT content,metadata FROM document_chunks WHERE source_id=${id} ORDER BY (metadata->>'index')::int`;
 if(source&&source.chunkCount===chunks.length&&rows.length===chunks.length&&rows.every((r,i)=>r.content===chunks[i].content&&r.metadata.startPage===chunks[i].metadata.startPage&&(!doc.provenance||r.metadata.textSha256===doc.provenance.textSha256)))return'existing';
 const vectors=await embed(chunks.map(c=>c.content));
 if(vectors.length!==chunks.length)throw Error('Número de vetores divergente');
 const license=doc.license??(doc.collectionId==='base-internas'?'Documento fictício de demonstração':'Síntese de referência com atribuição à fonte oficial pública');
 const data={userId,collectionId:doc.collectionId,filename:doc.title,sourceType:'base',originUrl:doc.url||null,license,topics:doc.topics,category:doc.collectionId==='base-artigos'?'Inteligência artificial e saúde':doc.collectionId==='base-internas'?'Normas internas':'Normativas e referências oficiais',summary:doc.text.slice(0,350),chunkCount:chunks.length};
 // A data da revisão muda nos reparos para invalidar fingerprints de cache/replay.
 // Só SQL sob a transação: embeddings ficam fora para não manter locks durante inferência.
 await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
  await tx.documentSource.upsert({where:{id},create:{id,...data},update:{...data,createdAt:new Date()}});
  await tx.$executeRaw`DELETE FROM document_chunks WHERE source_id=${id}`;
  await insertChunks(chunks.map((c,i)=>({sourceId:id,sourceType:'base',userId,collectionId:doc.collectionId,content:c.content,embedding:vectors[i],metadata:{...c.metadata,filename:doc.title,originUrl:doc.url,license,...doc.provenance}})),tx);
 });
 return source?'repaired':'created';
}
