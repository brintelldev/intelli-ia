import{prisma}from'@/lib/prisma';import{APPROVAL_TTL_MS}from'./approvals-core';
export async function approvalRequired(role:string){if(role!=='Analista')return false;const setting=await prisma.appSetting.findUnique({where:{key:'approvalRequired'}});return Array.isArray(setting?.value)&&setting.value.includes('brief_export');}
export const liveApprovals=()=>({createdAt:{gt:new Date(Date.now()-APPROVAL_TTL_MS)}});
