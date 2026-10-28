import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identifyNorm,searchSenado} from './senado';
import {searchSources} from './index';
import {SOURCE_DOMAINS} from '../search-core';
test('Senado identifica aliases e números de normas, sem inventar busca textual',()=>{
 assert.deepEqual(identifyNorm('bases legais da LGPD'),{type:'LEI',number:13709,year:2018});
 assert.deepEqual(identifyNorm('Lei nº 14.133/2021 princípios'),{type:'LEI',number:14133,year:2021});
 assert.deepEqual(identifyNorm('CLT relação de emprego'),{type:'DEL',number:5452,year:1943});
 assert.equal(identifyNorm('uma norma qualquer'),null);
});
test('Senado extrai identificação e ementa oficiais, limita texto e tolera indisponibilidade',async()=>{
 let url='';const loader:typeof fetch=async(input)=>{url=String(input);return Response.json({DetalheDocumento:{documentos:{documento:[{identificacao:{normaNome:'Lei nº 13.709',urlDocumento:'https://normas.leg.br/?urn=lgpd',apelido:'LGPD'},ementa:'Proteção de dados pessoais'}]}}});};
 const r=await searchSenado('LGPD',loader);assert.match(url,/LEI\/13709\/2018.json/);assert.equal(r[0].origin,'senado');assert.match(r[0].snippet,/Proteção/);assert.equal(r[0].type,'gov');
 assert.deepEqual(await searchSenado('LGPD',async()=>new Response('<html>captcha</html>')),[]);
 assert.deepEqual(await searchSenado('LGPD',async()=>Response.json({DetalheDocumento:{documentos:{documento:[{identificacao:{urlDocumento:'javascript:alert(1)'}}]}}})),[]);
 assert.deepEqual(await searchSenado('sem identificador',async()=>{throw Error('não deve chamar');}),[]);
});
test('fonte Senado independente do LexML e domínio judicial no filtro conjunto',async()=>{
 const result={url:'https://normas.leg.br/a',title:'Lei',snippet:'ementa',score:1,type:'gov' as const,origin:'senado' as const};
 const p={web:async()=>[],lexml:async()=>{throw Error('captcha');},openalex:async()=>[],senado:async()=>[result]};
 assert.deepEqual(await searchSources('LGPD','gov',p),[result]);
 assert.deepEqual(await searchSources('LGPD','academic',p),[]);
 assert.ok(SOURCE_DOMAINS.all_filtered.includes('jus.br'));
});
