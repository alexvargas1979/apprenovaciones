import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {authConfig} from './config';
export async function authClient(){
 const c=authConfig();if(c.provider!=='supabase')throw Error('Supabase Auth no está activo.');
 const jar=await cookies();
 return createServerClient(c.url,c.key,{cookieOptions:{httpOnly:true,sameSite:'lax',secure:c.secure,path:'/'},cookies:{
  getAll:()=>jar.getAll(),
  setAll:values=>{for(const {name,value,options} of values)jar.set(name,value,options);}
 }});
}
