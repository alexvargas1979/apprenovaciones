import {redirect} from 'next/navigation';
import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {authClient} from './supabase';
import {authConfig} from './config';
import {safeReturnPath} from './paths';
export async function getAppUser(){
 if(authConfig().provider==='sites')return getChatGPTUser();
 const {data,error}=await (await authClient()).auth.getUser();
 if(error||!data.user?.email_confirmed_at)return null;
 const u=data.user;return {userId:u.id,email:u.email??'',displayName:u.email??'Mi cuenta',fullName:null};
}
export async function requireAppUser(returnTo:string){
 const u=await getAppUser();if(u)return u;
 redirect(authConfig().provider==='sites'?chatGPTSignInPath(returnTo):'/ingresar?next='+encodeURIComponent(safeReturnPath(returnTo)));
}
