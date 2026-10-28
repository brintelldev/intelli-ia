import {maskPII,maskPIIUrl} from '@/lib/usage-core';
import type {ChatCitation,ChatMetadata} from './rag-core';
import {reportCitationText} from './report-citation';
type StoredMessage={id:string;role:string;parts:unknown;citations:unknown};
export function maskCitation(c:ChatCitation,mask:boolean,reports:ReadonlyMap<string,unknown>=new Map()){
 const snippet=(c.kind==='report'||c.reportId===c.sourceId)&&reports.has(c.sourceId)?reportCitationText(reports.get(c.sourceId)):c.snippet;
 return{...c,filename:mask?maskPII(c.filename):c.filename,snippet:mask?maskPII(snippet):snippet,...(c.originUrl?{originUrl:mask?maskPIIUrl(c.originUrl):c.originUrl}:{})};
}
/** Dependências transitivas são distintas das citações recuperadas na pergunta atual. */
export function messageDependencies(row:Pick<StoredMessage,'parts'|'citations'>):string[]{const citations=Array.isArray(row.citations)?row.citations as ChatCitation[]:[];const parts=Array.isArray(row.parts)?row.parts as {type:string;data?:unknown}[]:[];const inherited=parts.filter(p=>p.type==='data-dependencies').flatMap(p=>Array.isArray(p.data)?p.data.filter((id):id is string=>typeof id==='string'):[]);return [...new Set([...citations.map(c=>c.sourceId),...inherited])];}
/** Mensagens anteriores à marca de dependências recebem a união conservadora do contexto anterior. */
export function inheritLegacyDependencies<T extends StoredMessage>(rows:T[]):T[]{const prepared:T[]=[];for(const row of rows){const parts=Array.isArray(row.parts)?row.parts as {type:string;data?:unknown}[]:[];if(row.role==='assistant'&&!parts.some(p=>p.type==='data-dependencies')){const inherited=prepared.filter(m=>m.role==='user'||m.role==='assistant').slice(-10).flatMap(messageDependencies);prepared.push({...row,parts:[...parts,{type:'data-dependencies',data:[...new Set([...messageDependencies(row),...inherited])]}]});}else prepared.push(row);}return prepared;}
export function visibleMessage(row:StoredMessage,allowedSources:Set<string>,mask:boolean,reports:ReadonlyMap<string,unknown>=new Map()){
 const citations=Array.isArray(row.citations)?row.citations as ChatCitation[]:[];
 const dependencies=messageDependencies(row);
 const restricted=dependencies.some(id=>!allowedSources.has(id));
 const parts=Array.isArray(row.parts)?row.parts as {type:string;text?:string;data?:Partial<ChatMetadata>}[]:[];
 const meta=parts.find(p=>p.type==='data-meta')?.data;
 return{id:row.id,role:row.role==='assistant'?'assistant' as const:row.role==='system'?'system' as const:'user' as const,
  parts:parts.filter(p=>p.type==='text').map(p=>({type:'text' as const,text:restricted&&row.role==='assistant'?'Esta resposta contém informações de [fonte restrita]. Seu acesso à fonte não está disponível.':mask?maskPII(p.text??''):p.text??''})),
  metadata:meta,sourceDependencies:dependencies.filter(id=>allowedSources.has(id)),
  citations:citations.map(c=>allowedSources.has(c.sourceId)?maskCitation(c,mask,reports):{n:c.n,sourceId:'restricted',filename:'[fonte restrita]',snippet:'',score:0})};
}
