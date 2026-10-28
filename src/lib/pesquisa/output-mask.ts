import{maskPII,maskPIIUrl}from'../usage-core';
import type{Recording}from'../replay/core';
const CONTROL=new Set(['id','userId','sourceId','reportId','templateId','modelId','modelUsed','sourceFilter','phase','type','createdAt','updatedAt','fetchedAt','expiresAt']);
/** Redige somente valores de apresentação. IDs, datas e tipos conservam o contrato da API. */
export function maskResearchOutput<T>(value:T,mask:boolean):T {
 if(!mask)return value;
 const walk=(item:unknown,key?:string):unknown=>{
  if(typeof item==='string')return key&&/^(?:url|originUrl|href)$/i.test(key)?maskPIIUrl(item):maskPII(item);
  if(Array.isArray(item))return item.map(v=>walk(v));
  if(item instanceof Date)return item;
  if(item&&typeof item==='object')return Object.fromEntries(Object.entries(item).map(([key,v])=>[key,CONTROL.has(key)?v:walk(v,key)]));
  return item;
 };
 return walk(value) as T;
}
/** Gravações antigas também respeitam o filtro ATUAL do perfil, sem alterar o protocolo SSE. */
export function maskResearchRecording(record:Recording,mask:boolean):Recording {
 if(!mask)return record;
 if(!record.contentType.includes('text/event-stream')){try{return{...record,body:JSON.stringify(maskResearchOutput(JSON.parse(record.body),true))};}catch{return record;}}
 return{...record,body:record.body.split('\n').map(line=>{if(!line.startsWith('data: ')||line==='data: [DONE]')return line;try{return'data: '+JSON.stringify(maskResearchOutput(JSON.parse(line.slice(6)),true));}catch{return line;}}).join('\n')};
}
