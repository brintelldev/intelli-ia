import{requireRole,errorResponse}from'@/lib/session';import{getMetrics}from'@/lib/admin/metrics';
export async function GET(req:Request){try{await requireRole(['Admin','Analista']);return Response.json(await getMetrics(new URL(req.url).searchParams),{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e);}}
