import{test}from'node:test';import assert from'node:assert/strict';import{prepareIngestion,IngestBody}from'./ingest-core';
test('ingestão preserva página real, limita texto e rejeita vazio',()=>{
 assert.equal(IngestBody.safeParse({filename:'x.pdf',text:''}).success,false);
 const r=prepareIngestion({filename:'sintético.pdf',text:'Cláusula primeira. Vigência de doze meses.',pages:[{number:7,content:'Cláusula primeira. Vigência de doze meses.'}]});assert.ok(r.length>0);assert.equal(r[0].metadata.startPage,7);
 assert.equal(IngestBody.safeParse({filename:'x',text:'x'.repeat(2_000_001)}).success,false);
});
