import{requireRole,errorResponse}from'@/lib/session';import{prisma}from'@/lib/prisma';
export async function GET(){try{await requireRole(['Admin']);return Response.json(await prisma.user.findMany({where:{banned:{not:true}},select:{id:true,name:true,email:true,role:true},orderBy:{name:'asc'},take:200}));}catch(e){return errorResponse(e);}}
