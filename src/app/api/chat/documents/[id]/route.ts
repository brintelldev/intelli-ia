import{requireRole,errorResponse}from'@/lib/session';import{deleteDocument}from'@/lib/privacy';
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){try{const s=await requireRole(['Admin','Analista']);return Response.json(await deleteDocument((await params).id,{userId:s.user.id,role:s.role}));}catch(e){return errorResponse(e);}}
