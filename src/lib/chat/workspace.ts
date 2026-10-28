import type{ChatMessage}from'./respond';import type{ChatCitation,ChatMetadata}from'./rag-core';
export type SessionMessage={id:string;role:'user'|'assistant'|'system';parts:{type:string;text?:string}[];metadata?:Partial<ChatMetadata>;citations?:ChatCitation[]};
export function messagesForChat(rows:SessionMessage[]):ChatMessage[]{return rows.map(m=>({id:m.id,role:m.role,parts:[...m.parts.filter(p=>p.type==='text').map(p=>({type:'text' as const,text:p.text??''})),...(m.citations?.length?[{type:'data-citations' as const,id:'citations',data:m.citations}]:[])],...(m.metadata?{metadata:{cacheHit:m.metadata.cacheHit??false,generalKnowledge:m.metadata.generalKnowledge??false,createdAt:m.metadata.createdAt??'',modelId:m.metadata.modelId??''}}:{})}));}

/** O histórico confiável é carregado no servidor; não reenviar centenas de mensagens do navegador. */
export function requestMessages<T extends {role:string}>(messages:T[]):T[]{const last=messages.findLast(m=>m.role==='user');return last?[last]:[];}
