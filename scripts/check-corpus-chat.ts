/** Verificação real opcional: usa Haiku, fontes públicas e sessões descartáveis. */
import assert from'node:assert/strict';
import{prisma}from'../src/lib/prisma';
import{login,readParts}from'./lib/demo-client';
import{CORPUS_FULLTEXT}from'../prisma/corpus-fulltext-manifest';
import{corpusSourceId}from'../prisma/corpus-source';
async function main(){
 const client=await login();const user=await prisma.user.findUniqueOrThrow({where:{email:'analista@intellisuite.com'}});
 try{for(const[id,question,expected]of [
  ['clt-integral-20261027','Segundo o art. 922 da CLT, o art. 301 rege quais relações de emprego?',/iniciadas depois|iniciadas após|iniciadas.*vigência/i],
  ['anpd-agentes-integral-v2','Qual é a recomendação final do item 85 do guia de agentes de tratamento da ANPD?',/acompanh.*decisões|acompanhar.*autoridade/i],
 ] as const){
  const entry=CORPUS_FULLTEXT.find(e=>e.id===id)!,sourceId=corpusSourceId(entry);
  const session=await prisma.chatSession.create({data:{userId:user.id,title:'QA corpus integral, descarte'}});
  try{
   const start=Date.now();const response=await client.fetch('/api/chat',{method:'POST',body:JSON.stringify({id:session.id,messages:[{role:'user',parts:[{type:'text',text:question}]}],sourceId,forceFresh:true,modelId:'anthropic:claude-haiku-5-5'})});assert.ok(response.ok);
   const parts=await readParts(response),text=parts.filter(p=>p.type==='text-delta').map(p=>p.delta).join('');
   const citations=parts.find(p=>p.type==='data-citations')?.data as {sourceId:string;page?:number;snippet:string}[];
   assert.match(text,expected);assert.ok(citations?.some(c=>c.sourceId===sourceId));
   if(id.startsWith('clt'))assert.ok(citations.some(c=>/Art\. 922\./.test(c.snippet)));
   else assert.ok(citations.some(c=>(c.page??0)>=24));
   console.log(JSON.stringify({id,answerMatches:true,citations:citations.length,pages:[...new Set(citations.map(c=>c.page))],ms:Date.now()-start}));
  }finally{await prisma.chatSession.delete({where:{id:session.id}});}
 }}finally{await client.dispose();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Falha na verificação');process.exitCode=1;}).finally(()=>prisma.$disconnect());
