import {Readability} from '@mozilla/readability';import {parseHTML} from 'linkedom';
import {checkRobots} from './robots';import {safeFetch} from './safe-fetch';
export type ScrapedPage={url:string;title:string;content:string;fetchedAt:string;robotsAllowed:true;crawlDelayRespected:true};
type Dependencies={robots:(url:string)=>Promise<{allowed:boolean;crawlDelay:number}>;fetchPage:typeof safeFetch};
export function createScraper(deps:Dependencies){return async function scrape(url:string,signal?:AbortSignal):Promise<ScrapedPage|null>{
 try{
  const permission=await deps.robots(url);if(!permission.allowed)return null;
  const page=await deps.fetchPage(url,{signal,beforeRequest:deps.robots,delay:permission.crawlDelay});if(page.status!==200)return null;
  const mime=page.headers.get('content-type')?.split(';')[0].trim().toLowerCase();let title='',content='';
  if(mime==='text/html'){
   const html=new TextDecoder().decode(page.bytes);if(/<title[^>]*>[^<]*(captcha|verifica[çc][aã]o de seguran[çc]a|access denied|just a moment)/i.test(html))return null;
   const {document}=parseHTML(html);for(const el of document.querySelectorAll('script,style,noscript,iframe,form,img,svg'))el.remove();
   const article=new Readability(document as unknown as Document,{charThreshold:100}).parse();
   title=article?.title??document.title;content=article?.textContent?.trim()??document.querySelector('main,article')?.textContent?.trim()??'';
  }else if(mime==='application/pdf'){
   if(new TextDecoder().decode(page.bytes.slice(0,5))!=='%PDF-')return null;
   const {default:pdf2md}=await import('@opendocsg/pdf2md');content=await pdf2md(page.bytes.buffer as ArrayBuffer);title=new URL(page.url).pathname.split('/').pop()??'Documento PDF';
  }else return null;
  if(!content.trim())return null;
  return{url:page.url,title:title?.trim()||new URL(page.url).hostname,content:content.slice(0,1_000_000),fetchedAt:new Date().toISOString(),robotsAllowed:true,crawlDelayRespected:true};
 }catch{return null;}
};}
export const scrape=createScraper({robots:checkRobots,fetchPage:safeFetch});
