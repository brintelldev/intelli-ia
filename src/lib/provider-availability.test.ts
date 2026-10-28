import{test}from'node:test';import assert from'node:assert/strict';import{missingProviderKeys}from'./provider-availability';
test('provedor sem chave ou com chave vazia não é oferecido como disponível',()=>{
 assert.deepEqual(missingProviderKeys({ANTHROPIC_API_KEY:'configurada',GOOGLE_GENERATIVE_AI_API_KEY:'configurada'}),['openai']);
 assert.deepEqual(missingProviderKeys({ANTHROPIC_API_KEY:'   ',OPENAI_API_KEY:'',GOOGLE_GENERATIVE_AI_API_KEY:undefined}),['anthropic','openai','google']);
 assert.deepEqual(missingProviderKeys({ANTHROPIC_API_KEY:'a',OPENAI_API_KEY:'b',GOOGLE_GENERATIVE_AI_API_KEY:'c'}),[]);
});
