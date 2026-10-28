import{requireRole,errorResponse}from'@/lib/session';import{CollectionBody,saveCollection,removeCollection}from'@/lib/chat/collections';
type Context={params:Promise<{id:string}>};
export async function PUT(req:Request,{params}:Context){try{const s=await requireRole(['Admin']);const p=CollectionBody.safeParse(await req.json().catch(()=>null));if(!p.success)return Response.json({error:p.error.issues[0]?.message},{status:400});return Response.json(await saveCollection(p.data,s.user.id,(await params).id));}catch(e){return errorResponse(e);}}
export async function DELETE(_req:Request,{params}:Context){try{const s=await requireRole(['Admin']);await removeCollection((await params).id,s.user.id);return Response.json({deleted:true});}catch(e){return errorResponse(e);}}
