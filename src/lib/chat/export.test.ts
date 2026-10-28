import{test}from'node:test';import assert from'node:assert/strict';import{chatExport}from'./export';import{toJson}from'@/lib/export/simple';
test('exportação consolida conversa e renumera citações por mensagem sem perder scores/IDs no JSON',async()=>{
 const data=chatExport('Conversa de teste',[{id:'a',role:'assistant',parts:[{type:'text',text:'Primeira [1]'},{type:'data-citations',data:[{n:1,sourceId:'fonte-a',filename:'A',snippet:'a',score:0.9}]}]},{id:'b',role:'assistant',parts:[{type:'text',text:'Segunda [1]'},{type:'data-citations',data:[{n:1,sourceId:'fonte-b',filename:'B',snippet:'b',score:0.8}]}]}],'2026-10-27');
 assert.ok(data.sections[1].content.includes('[2]'));assert.equal(data.citations?.length,2);const parsed=JSON.parse(await toJson(data).text());assert.equal(parsed.structured.messages[1].citations[0].score,0.8);assert.equal(parsed.structured.messages[1].citations[0].sourceId,'fonte-b');
});
