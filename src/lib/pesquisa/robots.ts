import robotsParser from 'robots-parser';import {safeFetch} from './safe-fetch';
export type RobotsResult={allowed:boolean;crawlDelay:number;checkedAt:string;reason?:string};
type Loader=(url:string)=>Promise<{status:number;text:string}>;
export function createRobotsChecker(load:Loader,now=Date.now){
 const cache=new Map<string,{expires:number;status:number;text:string}>();const pending=new Map<string,Promise<{status:number;text:string}>>();
 return async function checkRobots(raw:string):Promise<RobotsResult>{
  const checkedAt=new Date(now()).toISOString();
  try{const url=new URL(raw);if(!['http:','https:'].includes(url.protocol))throw Error('protocolo');
   const key=url.origin;let entry=cache.get(key);
   if(!entry||entry.expires<=now()){
    let request=pending.get(key);if(!request){request=load(`${key}/robots.txt`);pending.set(key,request);}
    try{const result=await request;entry={...result,expires:now()+3_600_000};cache.set(key,entry);}finally{pending.delete(key);}
    if(cache.size>1000)for(const [k,v]of cache)if(v.expires<=now())cache.delete(k);
   }
   if([404,410].includes(entry.status))return{allowed:true,crawlDelay:1,checkedAt};
   if(entry.status!==200||/<(?:!doctype|html|script)/i.test(entry.text))return{allowed:false,crawlDelay:1,checkedAt,reason:'Não foi possível verificar as regras de coleta.'};
   const robots=robotsParser(`${key}/robots.txt`,entry.text);return{allowed:robots.isAllowed(url.href,'IntelliSuiteBot')!==false,crawlDelay:Math.max(1,robots.getCrawlDelay('IntelliSuiteBot')??1),checkedAt};
  }catch{return{allowed:false,crawlDelay:1,checkedAt,reason:'Não foi possível verificar as regras de coleta.'};}
 };
}
export const checkRobots=createRobotsChecker(async url=>{const r=await safeFetch(url,{maxBytes:512*1024});return{status:r.status,text:new TextDecoder().decode(r.bytes)};});
