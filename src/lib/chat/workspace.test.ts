import{test}from'node:test';import assert from'node:assert/strict';import{messagesForChat}from'./workspace';
test('recarregar restaura texto, citações e metadata da sessão no formato do useChat',()=>{const messages=messagesForChat([{id:'m',role:'assistant',parts:[{type:'text',text:'Resposta [1]'}],metadata:{cacheHit:true,createdAt:'2026-10-27',modelId:'Haiku',generalKnowledge:false},citations:[{n:1,sourceId:'a',filename:'Norma',snippet:'Fonte',score:0.8}]}]);assert.equal(messages[0].id,'m');assert.equal(messages[0].metadata?.cacheHit,true);const cite=messages[0].parts.find(p=>p.type==='data-citations');assert.ok(cite?.type==='data-citations'&&cite.data[0].score===0.8);});
test('transporte de conversa longa envia só a última pergunta, com contexto vindo do banco',async()=>{
 const {requestMessages}=await import('./workspace');const messages=Array.from({length:401},(_,i)=>({id:String(i),role:i%2?'assistant' as const:'user' as const,parts:[{type:'text' as const,text:`Mensagem ${i}`}]}));
 const request=requestMessages(messages);assert.equal(request.length,1);assert.equal(request[0].id,'400');
});
