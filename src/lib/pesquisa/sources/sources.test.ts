import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchLexML } from './lexml';
import { searchOpenAlex } from './openalex';
import { searchSources } from './index';
test('LexML: XML SRU com namespace, ementa e URN; desafio HTML não é resultado', async()=>{
 const xml=`<zs:searchRetrieveResponse xmlns:zs="urn:z"><zs:records><zs:record><zs:recordData><srw_dc:dc xmlns:srw_dc="urn:dc"><dc:title xmlns:dc="dc">Lei 13.709</dc:title><dc:identifier xmlns:dc="dc">urn:lex:br:federal:lei:2018-08-14;13709</dc:identifier><dc:description xmlns:dc="dc">LGPD &amp; proteção</dc:description></srw_dc:dc></zs:recordData></zs:record></zs:records></zs:searchRetrieveResponse>`;
 const result=await searchLexML('LGPD',5,async()=>new Response(xml,{headers:{'content-type':'application/xml'}}));
 assert.equal(result[0].title,'Lei 13.709');assert.equal(result[0].snippet,'LGPD & proteção');assert.ok(result[0].url.includes('urn:lex:'));assert.equal(result[0].origin,'lexml');
 assert.deepEqual(await searchLexML('LGPD',5,async()=>new Response('<html>CAPTCHA</html>')),[]);
});
test('OpenAlex: resumo invertido, link aberto, DOI/autores/ano e rejeita link não HTTP',async()=>{
 const r=await searchOpenAlex('saúde',5,async()=>Response.json({results:[{display_name:'Artigo',doi:'https://doi.org/10.123/x',publication_year:2024,authorships:[{author:{display_name:'Ana'}}],open_access:{oa_url:'https://scielo.br/artigo'},abstract_inverted_index:{Saúde:[0],pública:[1]},relevance_score:4}]}));
 assert.equal(r[0].url,'https://scielo.br/artigo');assert.ok(r[0].snippet.includes('Saúde pública'));assert.ok(r[0].snippet.includes('10.123/x'));assert.equal(r[0].type,'academic');
});
test('fontes independentes: falha LexML mantém web; governamental não chama OpenAlex',async()=>{
 let academic=false; const web={url:'https://gov.br/x',title:'x',snippet:'x',score:1,type:'gov' as const,origin:'tavily' as const};
 const r=await searchSources('q','gov',{web:async()=>[web],lexml:async()=>{throw Error('fora');},openalex:async()=>{academic=true;return[];}});
 assert.deepEqual(r,[web]);assert.equal(academic,false);
});
