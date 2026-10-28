import {safeFetch} from '../safe-fetch';
import type {SearchResult} from '../search-core';

type Norm={type:string;number:number;year:number};
/** O serviço público consulta normas identificadas; não oferece busca livre por assunto. */
export function identifyNorm(query:string):Norm|null {
 const q=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const explicit=/(decreto[-\s]*lei|lei\s+complementar|lei|emenda\s+constitucional)\s*(?:n[ºo°.]?\s*)?(\d[\d.]*)(?:\s*\/\s*|\s+de\s+)(\d{4})\b/.exec(q);
 if(explicit)return{type:explicit[1].startsWith('decreto')?'DEL':explicit[1].includes('complementar')?'LCP':explicit[1].startsWith('emenda')?'EMC':'LEI',number:Number(explicit[2].replace(/\./g,'')),year:Number(explicit[3])};
 if(/\blgpd\b|lei geral de protecao de dados/.test(q))return{type:'LEI',number:13709,year:2018};
 if(/\bclt\b|consolidacao das leis do trabalho/.test(q))return{type:'DEL',number:5452,year:1943};
 if(/lei de licitacoes/.test(q))return{type:'LEI',number:14133,year:2021};
 return null;
}
export async function searchSenado(query:string,fetcher:typeof fetch=fetch):Promise<SearchResult[]> {
 const norm=identifyNorm(query);if(!norm)return[];
 try{
  const endpoint=`https://legis.senado.leg.br/dadosabertos/legislacao/${norm.type}/${norm.number}/${norm.year}.json`;
  // safeFetch agenda no mínimo 1 s entre chamadas ao mesmo host (API pública: teto 10/s).
  const request:typeof fetch=fetcher===fetch?async()=>{const r=await safeFetch(endpoint,{maxBytes:2_000_000});return new Response(r.bytes as BodyInit,{status:r.status,headers:r.headers});}:fetcher;
  const response=await request(`https://legis.senado.leg.br/dadosabertos/legislacao/${norm.type}/${norm.number}/${norm.year}.json`,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json','User-Agent':'IntelliSuiteBot/1.0'},redirect:'error'});
  if(!response.ok)return[];
  // Limita a leitura inclusive quando o servidor omite Content-Length.
  const reader=response.body?.getReader();if(!reader)return[];const parts:Uint8Array[]=[];let bytes=0;
  try{while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.length;if(bytes>2_000_000){await reader.cancel();return[];}parts.push(r.value);}}finally{reader.releaseLock();}
  const text=new TextDecoder().decode(Buffer.concat(parts));
  const data=JSON.parse(text);const docs=data?.DetalheDocumento?.documentos?.documento;
  return (Array.isArray(docs)?docs:docs?[docs]:[]).slice(0,5).flatMap(d=>{
   const id=d?.identificacao; if(typeof id?.urlDocumento!=='string'||typeof id?.normaNome!=='string')return[];
   const url=new URL(id.urlDocumento);if(url.protocol!=='https:'||!['normas.leg.br','legis.senado.leg.br','legis.senado.gov.br'].includes(url.hostname)||url.username||url.password)return[];
   return[{url:url.href,title:id.normaNome.slice(0,500),snippet:[d.ementa,id.apelido,d.observacao].filter(v=>typeof v==='string').join('\n').slice(0,3000),score:1,type:'gov' as const,origin:'senado' as const}];
  });
 }catch{return[];}
}
