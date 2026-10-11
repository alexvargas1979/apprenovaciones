export function safeReturnPath(value:unknown):string{
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20]/.test(value))return '/cuenta';
 try{const u=new URL(value,'https://app.local');if(u.origin!=='https://app.local'||/^\/(auth|ingresar|recuperar|signin-with-chatgpt|signout-with-chatgpt)(\/|$)/.test(u.pathname))return '/cuenta';return u.pathname+u.search;}catch{return '/cuenta';}
}
