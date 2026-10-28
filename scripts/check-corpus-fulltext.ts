/** Verificação de leitura: nenhum documento/permissão é alterado. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prisma} from '../src/lib/prisma';
import {CORPUS_FULLTEXT} from '../prisma/corpus-fulltext-manifest';
import {loadFullText} from '../prisma/load-corpus-fulltext';
import {buildDocument} from '../src/lib/pdf/document';
import {chunkDocument} from '../src/lib/pdf/chunker';
import {embed} from '../src/lib/embeddings';
import {similaritySearch} from '../src/lib/vector-store';
async function main(){
 const admin=await prisma.user.findFirstOrThrow({where:{role:'Admin'}});let total=0;
 for(const entry of CORPUS_FULLTEXT){
  const id=`corpus-${createHash('sha256').update(entry.collectionId+entry.title).digest('hex').slice(0,24)}`;
  const source=await prisma.documentSource.findUniqueOrThrow({where:{id}});
  const full=await loadFullText(entry),expected=chunkDocument(buildDocument(full.markdown??full.text));
  const rows=await prisma.$queryRaw<{content:string;metadata:{index:number;textSha256:string;rawSha256:string;edition:string}}[]>`SELECT content,metadata FROM document_chunks WHERE source_id=${id} ORDER BY (metadata->>'index')::int`;
  assert.equal(rows.length,expected.length);assert.equal(source.chunkCount,expected.length);
  for(let i=0;i<rows.length;i++){assert.equal(rows[i].content,expected[i].content);assert.equal(rows[i].metadata.textSha256,entry.textSha256);assert.equal(rows[i].metadata.rawSha256,full.rawSha256);assert.equal(rows[i].metadata.edition,entry.edition);}
  // Trecho no final do documento: prova que o índice não se limita a ficha/resumo/início.
  const tail=rows.at(-1)!;const query=await embed(tail.content);const start=performance.now();
  const hits=await similaritySearch({embedding:query,topK:1,sourceId:id,sourceType:'base',access:{userId:admin.id,isAdmin:true,collectionIds:[]}});
  const ms=Math.round(performance.now()-start);assert.equal(hits[0]?.content,tail.content);assert.ok(hits[0].score>0.98);
  total+=rows.length;console.log(JSON.stringify({id:entry.id,chars:full.text.length,chunks:rows.length,allChunksMatch:true,tailScore:hits[0].score,searchMs:ms}));
 }
 console.log(JSON.stringify({fullTexts:CORPUS_FULLTEXT.length,totalChunks:total,verified:true}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Falha na verificação');process.exitCode=1;}).finally(()=>prisma.$disconnect());
