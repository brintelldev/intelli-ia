import {searchSenado} from '../src/lib/pesquisa/sources/senado';
import {searchLexML} from '../src/lib/pesquisa/sources/lexml';
import {searchOpenAlex} from '../src/lib/pesquisa/sources/openalex';
async function main(){for(const [name,call]of [['Senado',()=>searchSenado('lei geral de proteção de dados')],['LexML',()=>searchLexML('lei geral de proteção de dados')],['OpenAlex',()=>searchOpenAlex('machine learning saúde pública Brasil')]] as const){const t=Date.now();const results=await call();console.log(JSON.stringify({source:name,ms:Date.now()-t,count:results.length,results:results.map(r=>({title:r.title,url:r.url,origin:r.origin}))}));}}
main();
