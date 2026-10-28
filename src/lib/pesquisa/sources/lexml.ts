import { XMLParser } from 'fast-xml-parser';
import type { SearchResult } from '../search-core';
const list=(v:unknown): unknown[]=>v===undefined?[]:Array.isArray(v)?v:[v];
const obj=(v:unknown)=>v && typeof v==='object'?v as Record<string,unknown>:{};
const scalar=(v:unknown):string=>typeof v==='string'?v:typeof v==='number'?String(v):typeof obj(v)['#text']==='string'?String(obj(v)['#text']):'';
/** SRU público. ponytail: o Senado pode exigir CAPTCHA; não contornar, retorna vazio e mantém outras fontes. */
export async function searchLexML(query:string,limit=5,fetcher:typeof fetch=fetch):Promise<SearchResult[]> {
 try {
  const url=new URL('https://www.lexml.gov.br/busca/SRU');url.search=new URLSearchParams({operation:'searchRetrieve',version:'1.1',query,maximumRecords:String(Math.min(5,Math.max(1,limit)))}).toString();
  const r=await fetcher(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/xml','User-Agent':'IntelliSuiteBot/1.0'},redirect:'error'});
  if(!r.ok)return[];const xml=await r.text();if(xml.length>2_000_000||!xml.includes('searchRetrieveResponse')||/<!DOCTYPE|<!ENTITY/i.test(xml))return[];
  const root=new XMLParser({removeNSPrefix:true,ignoreAttributes:true,processEntities:true}).parse(xml);
  const rows=list(root.searchRetrieveResponse?.records?.record);
  return rows.flatMap(row=>{
   const data=obj(obj(row).recordData);const dc=obj(data.dc??data);const title=scalar(list(dc.title)[0]);
   const identifiers=list(dc.identifier).map(scalar);const urn=identifiers.find(v=>v.startsWith('urn:lex:'));
   const link=identifiers.find(v=>/^https?:\/\//.test(v))??(urn?`https://www.lexml.gov.br/urn/${urn}`:'');
   if(!title||!link)return[];
   return [{url:link,title,snippet:scalar(list(dc.description)[0]),...(urn?{urn}:{}),score:1,type:'gov' as const,origin:'lexml' as const}];
  }).slice(0,limit);
 }catch{return[];}
}
