import {rawDb} from '@/db';
import {user,fail} from '@/lib/server';

export async function GET(req:Request){
  try{
    const uid=await user();const id=new URL(req.url).searchParams.get('id');
    const row=await rawDb().prepare(`SELECT b.original_payload,b.original_updated_at,b.captured_at
      FROM property_baselines b INNER JOIN properties p ON p.id=b.property_id AND p.user_id=b.user_id
      WHERE b.property_id=? AND b.user_id=?`).bind(id??'',uid)
      .first<{original_payload:string;original_updated_at:string;captured_at:string}>();
    if(!row)return Response.json({error:'No hay un respaldo inicial para esta propiedad.'},{status:404});
    return Response.json({format:'rehab-atlanta-baseline-v1',capturedAt:row.captured_at,
      originalUpdatedAt:row.original_updated_at,property:JSON.parse(row.original_payload)},
      {headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename="respaldo-inicial-propiedad.json"'}});
  }catch(e){return fail(e);}
}
