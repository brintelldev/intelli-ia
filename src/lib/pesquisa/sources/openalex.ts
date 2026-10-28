import type { SearchResult } from '../search-core';
type Work={display_name?:string;doi?:string;id?:string;publication_year?:number;authorships?:{author?:{display_name?:string}}[];open_access?:{oa_url?:string};abstract_inverted_index?:Record<string,number[]>;relevance_score?:number};
function http(value:string|undefined):string|undefined{try{const u=new URL(value??'');return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}}
export async function searchOpenAlex(query:string,limit=5,fetcher:typeof fetch=fetch):Promise<SearchResult[]> {
 try {
  const url=new URL('https://api.openalex.org/works');url.search=new URLSearchParams({search:query,filter:'is_oa:true',per_page:String(Math.min(5,Math.max(1,limit)))}).toString();
  // Endereço de contato apenas quando configurado pelo operador; não inventar e-mail do usuário.
  const contact=process.env.OPENALEX_CONTACT_EMAIL;
  const r=await fetcher(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':`IntelliSuiteBot/1.0${contact?` (mailto:${contact})`:''}`},redirect:'error'});
  if(!r.ok)return[];const payload=await r.json();if(!Array.isArray(payload.results))return[];
  const rows=payload.results as Work[];const max=Math.max(1,...rows.map(w=>Number(w.relevance_score)||0));
  return rows.flatMap(w=>{
   const link=http(w.open_access?.oa_url)??http(w.doi)??http(w.id);if(!link||!w.display_name)return[];
   const words:[number,string][]=[];
   for(const [word,positions] of Object.entries(w.abstract_inverted_index??{}))for(const p of positions.slice(0,1000))if(Number.isInteger(p)&&p>=0&&p<10000)words.push([p,word]);
   const abstract=words.sort((a,b)=>a[0]-b[0]).map(v=>v[1]).join(' ').slice(0,3000);
   return [{url:link,title:w.display_name,snippet:[w.authorships?.slice(0,4).map(a=>a.author?.display_name).filter(Boolean).join(', '),w.publication_year,w.doi,abstract].filter(Boolean).join(' — '),score:Math.min(1,Math.max(0,(Number(w.relevance_score)||0)/max)),type:'academic' as const,origin:'openalex' as const}];
  }).slice(0,limit);
 }catch{return[];}
}
