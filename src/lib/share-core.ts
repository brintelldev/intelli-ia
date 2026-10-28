import '@/lib/zod-pt';import{z}from'zod';
export const ShareBody=z.object({kind:z.enum(['chat','report']),targetId:z.string().min(1).max(100)});
export function shareAvailable(row:{revokedAt:Date|null;expiresAt:Date}|null,enabled:boolean,now=new Date()){return enabled&&!!row&&!row.revokedAt&&row.expiresAt>now;}
