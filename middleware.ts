import {NextResponse,type NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {authConfig} from './lib/auth/config';
export async function middleware(req:NextRequest){
 const c=authConfig();if(c.provider==='sites')return NextResponse.next();
 let response=NextResponse.next();
 const finish=(r:NextResponse)=>{for(const cookie of response.cookies.getAll())r.cookies.set(cookie);r.headers.set('Cache-Control','private, no-store');r.headers.set('Referrer-Policy','no-referrer');return r;};
 const path=req.nextUrl.pathname;
 if(path.startsWith('/auth/')||path==='/ingresar'||path==='/recuperar')return finish(response);
 const supabase=createServerClient(c.url,c.key,{cookieOptions:{httpOnly:true,sameSite:'lax',secure:c.secure,path:'/'},cookies:{getAll:()=>req.cookies.getAll(),setAll:values=>{
  values.forEach(({name,value})=>req.cookies.set(name,value));
  response=NextResponse.next({request:{headers:req.headers}});
  values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
 }}});
 const {data,error}=await supabase.auth.getUser();
 if(error||!data.user?.email_confirmed_at){
  if(path.startsWith('/api/'))return finish(NextResponse.json({error:'Inicia sesión para continuar.'},{status:401}));
  const target=new URL('/ingresar',c.origin);target.searchParams.set('next',path+req.nextUrl.search);return finish(NextResponse.redirect(target));
 }
 // PostgreSQL preview reads enforce their own local opt-in guard.
 // Owner and scenario write routes enforce their own local write opt-in.
 if(path.startsWith('/api/')&&!((req.method==='GET'&&['/api/properties','/api/accounting','/api/preview/scenarios','/api/invoice-drafts','/api/expense-reports','/api/oversight'].includes(path))||(req.method==='PUT'&&path==='/api/properties')||(req.method==='PATCH'&&path==='/api/properties/name')||(req.method==='POST'&&['/api/accounting','/api/operations','/api/invoice-drafts','/api/expense-recurring','/api/expense-reports','/api/reports','/api/scenarios/duplicate','/api/scenarios/save','/api/scenarios/approve','/api/scenarios/stress'].includes(path))))return finish(NextResponse.json({error:'La migración de datos está pendiente. Tu sesión está activa.'},{status:503}));
 if(path==='/'||path==='/equipo')return finish(NextResponse.redirect(new URL('/cuenta',c.origin)));
 return finish(response);
}
export const config={matcher:['/','/equipo/:path*','/api/:path*','/auth/:path*','/ingresar','/recuperar','/cuenta','/ensayo']};
