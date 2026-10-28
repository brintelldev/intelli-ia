import{test}from'node:test';import assert from'node:assert/strict';import{referencePattern}from'./reference-query';
test('referências explícitas são limitadas a números de artigos e parágrafos de origem',()=>{
 const pattern=referencePattern('Segundo o art. 922 da CLT, o art. 301 rege quais relações?')!;const re=new RegExp(pattern.replaceAll('[[:space:]]','\\s'),'i');
 assert.ok(re.test('Art. 922. O disposto no art. 301...'));assert.ok(re.test('Art. 301 O exercício...'));
 assert.ok(!re.test('Art. 9220. Outro dispositivo'));assert.ok(!re.test('Vide art. 922'));assert.equal(referencePattern('hipóteses de tratamento'),null);
});
