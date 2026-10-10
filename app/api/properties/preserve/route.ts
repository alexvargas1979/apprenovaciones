import {rawDb} from '@/db';
import {user,fail} from '@/lib/server';
import {preserveProperties} from '@/lib/preservation';

export async function POST(req:Request){
  try{return Response.json(await preserveProperties(rawDb(),await user(req)),{headers:{'Cache-Control':'no-store'}});}
  catch(e){return fail(e);}
}
