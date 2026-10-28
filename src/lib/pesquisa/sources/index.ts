import type { SourceFilter,SearchResult } from '../search-core';
import {searchSenado} from './senado';
import {searchLexML} from './lexml';import {searchOpenAlex} from './openalex';
type Providers={senado?:(q:string)=>Promise<SearchResult[]>;web:(q:string,f:SourceFilter)=>Promise<SearchResult[]>;lexml:(q:string)=>Promise<SearchResult[]>;openalex:(q:string)=>Promise<SearchResult[]>};
export async function searchSources(query:string,filter:SourceFilter,providers?:Providers):Promise<SearchResult[]>{
 const p=providers??{web:async(q,f)=>(await import('../search')).search(q,f),lexml:searchLexML,openalex:searchOpenAlex,senado:searchSenado};
 const calls=[p.web(query,filter)];if(filter!=='academic'){calls.push(p.lexml(query));if(p.senado)calls.push(p.senado(query));}if(filter!=='gov')calls.push(p.openalex(query));
 const r=await Promise.allSettled(calls);const seen=new Set<string>();
 return r.flatMap(v=>v.status==='fulfilled'?v.value:[]).sort((a,b)=>b.score-a.score).filter(v=>!seen.has(v.url)&&!!seen.add(v.url));
}
