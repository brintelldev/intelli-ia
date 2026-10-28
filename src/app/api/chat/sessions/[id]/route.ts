import{maskForRole}from'@/lib/usage';
import{requireRole,errorResponse}from'@/lib/session';import{prisma}from'@/lib/prisma';import{ROLES}from'@/lib/rbac';import{deleteChatSession}from'@/lib/privacy';import{sessionMessages}from'@/lib/chat/history';
type Context={params:Promise<{id:string}>};
export async function GET(_req:Request,{params}:Context){try{const s=await requireRole(ROLES);const{id}=await params;const row=await prisma.chatSession.findFirst({where:{id,userId:s.user.id}});if(!row)return Response.json({error:'Conversa não encontrada.'},{status:404});return Response.json({...row,title:await maskForRole(row.title,s.role),messages:await sessionMessages(id,s.user.id,s.role)});}catch(e){return errorResponse(e);}}
export async function DELETE(_req:Request,{params}:Context){try{const s=await requireRole(ROLES);return Response.json(await deleteChatSession((await params).id,{userId:s.user.id,role:s.role}));}catch(e){return errorResponse(e);}}
