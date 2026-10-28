import{maskResearchOutput}from'@/lib/pesquisa/output-mask';import{isMaskingEnabled}from'@/lib/usage';
import{requireRole,errorResponse}from'@/lib/session';import{prisma}from'@/lib/prisma';import{deleteResearchReport}from'@/lib/privacy';
type Context={params:Promise<{id:string}>};
export async function GET(_req:Request,{params}:Context){try{const s=await requireRole(['Admin','Analista']);const{id}=await params;const row=await prisma.researchReport.findFirst({where:{id,userId:s.user.id}});return row?Response.json(maskResearchOutput(row,await isMaskingEnabled(s.role))):Response.json({error:'Pesquisa não encontrada.'},{status:404});}catch(e){return errorResponse(e);}}
export async function DELETE(_req:Request,{params}:Context){try{const s=await requireRole(['Admin','Analista']);const{id}=await params;return Response.json(await deleteResearchReport(id,{userId:s.user.id,role:s.role}));}catch(e){return errorResponse(e);}}
