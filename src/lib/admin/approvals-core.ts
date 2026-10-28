import '@/lib/zod-pt';import{z}from'zod';
export const APPROVAL_TTL_MS=24*60*60*1000;
export const ApprovalRequestBody=z.strictObject({contentHash:z.string().regex(/^[a-f0-9]{64}$/),format:z.enum(['pdf','docx','xlsx','json','md']),title:z.string().trim().max(120).default('Parecer técnico'),preview:z.string().max(2000).optional()});
export const ReviewBody=z.strictObject({id:z.string().min(1).max(100),status:z.enum(['approved','rejected']),reviewNote:z.string().trim().max(500).optional()}).refine(v=>v.status!=='rejected'||!!v.reviewNote,{message:'Informe o motivo da rejeição.'});
export function approvalUsable(row:{requesterId:string;status:string;createdAt:Date;payload:unknown},userId:string,input:{contentHash:string;format:string},now=new Date()){const p=row.payload as Record<string,unknown>|null;return row.requesterId===userId&&row.status==='approved'&&now.getTime()-row.createdAt.getTime()<APPROVAL_TTL_MS&&p?.contentHash===input.contentHash&&p?.format===input.format;}
