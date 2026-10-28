import{test}from'node:test';import assert from'node:assert/strict';import{summarizeAll}from'./summarize';
test('map-reduce visita todas as partes e reduz novamente quando as notas ainda excedem contexto',async()=>{
 const seen:string[]=[];let reductions=0;const result=await summarizeAll(Array.from({length:20},(_,i)=>`FATO-${i} `+'x'.repeat(30)),async(text,_i,pass)=>{if(pass===0){seen.push(text);return'Nota preservada de cada parte. ';}reductions++;return'Resumo consolidado.';},{groupChars:100,finalChars:80});
 for(let i=0;i<20;i++)assert.ok(seen.join('').includes(`FATO-${i} `));assert.ok(reductions>0);assert.ok(result.length<=80);
});
