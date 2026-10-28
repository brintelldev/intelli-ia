import {extractPDF} from '../src/lib/pdf/extract-client';
import {buildDocument,PAGE_BREAK} from '../src/lib/pdf/document';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {safeFetch} from '../src/lib/pesquisa/safe-fetch';
import {checkRobots} from '../src/lib/pesquisa/robots';
import {extractJats,extractOfficialHtml,validateFullText} from '../src/lib/corpus-fulltext';
import type {FullTextEntry} from './corpus-fulltext-manifest';
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export async function loadFullText(entry:FullTextEntry){
 const file=`.cache/corpus/${entry.id}.json`;
 function validate(raw:{text:string;markdown?:string;url:string;fetchedAt:string;rawSha256:string;robotsAllowed:boolean}){
  validateFullText(raw.text,entry);
  if(entry.format==='pdf'){
   if(typeof raw.markdown!=='string')throw Error('Paginação do PDF ausente');
   const document=buildDocument(raw.markdown);
   if(document.text!==raw.text||document.pages.length!==entry.pages)throw Error('Paginação/integridade do PDF divergente');
  }
  if(sha(raw.text)!==entry.textSha256||raw.url!==entry.url||raw.robotsAllowed!==true||!/^\d{4}-\d{2}-\d{2}T/.test(raw.fetchedAt)||!/^[a-f0-9]{64}$/.test(raw.rawSha256))throw Error('Integridade/procedência do corpus divergente');
  return{...raw,license:entry.license,edition:entry.edition,textSha256:entry.textSha256};
 }
 // Cache local só é aceito com texto integral e SHA previamente auditado no manifesto.
 try{return validate(JSON.parse(await readFile(file,'utf8')));}catch{}
 const permission=await checkRobots(entry.url);if(!permission.allowed)throw Error('Coleta não permitida');
 const result=await safeFetch(entry.url,{maxBytes:2*1024*1024,beforeRequest:checkRobots,delay:permission.crawlDelay});
 if(result.status!==200)throw Error(`Fonte indisponível: HTTP ${result.status}`);
 const mime=result.headers.get('content-type')??'';
 if(entry.format==='jats'?!/xml/i.test(mime):entry.format==='pdf'?!/application\/pdf/i.test(mime):!/text\/html/i.test(mime))throw Error('Formato da fonte divergente');
 const body=new TextDecoder().decode(result.bytes);
 let text:string;let markdown:string|undefined;
 if(entry.format==='pdf'){
  if(!body.startsWith('%PDF-'))throw Error('Arquivo PDF inválido');
  const document=await extractPDF(new File([Uint8Array.from(result.bytes).buffer],entry.id+'.pdf',{type:'application/pdf'}));
  text=document.text;markdown=document.pages.map(p=>p.content).join(`\n${PAGE_BREAK}\n`);
 }else text=entry.format==='jats'?extractJats(body,entry.doi!).text:extractOfficialHtml(body);
 const doc=validate({text,...(markdown?{markdown}:{}),url:entry.url,fetchedAt:new Date().toISOString(),rawSha256:sha(result.bytes),robotsAllowed:true});
 await mkdir('.cache/corpus',{recursive:true});await writeFile(file,JSON.stringify(doc),{mode:0o600});return doc;
}
