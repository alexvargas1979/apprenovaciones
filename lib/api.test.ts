import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fresh} from './model';
const cookie=readFileSync('../dev-cookies.txt','utf8').split('\n').filter(l=>l.includes('\t')).map(l=>{const a=l.split('\t');return `${a[5]}=${a[6]}`}).join('; ');
async function call(path:string,method='GET',body?:unknown,origin='http://localhost:3000'){const r=await fetch('http://localhost:3000/api/'+path,{method,headers:{cookie,origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const t=await r.text();let data;try{data=JSON.parse(t)}catch{data=t}return {status:r.status,data};}
const p=fresh();p.name='QA temporal';let r=await call('properties','PUT',p);assert.equal(r.status,200,JSON.stringify(r));console.log('save response keys',Object.keys(r.data));
const saved=(await call('properties')).data.properties.find((x:any)=>x.id===p.id);assert.equal(saved.name,p.name);assert.equal((await call('properties','PUT',p)).status,409);saved.name='QA editada';assert.equal((await call('properties','PUT',saved)).status,200);assert.equal((await call('properties','PUT',saved,'https://example.org')).status,403);console.log('Passed API: create, reload, update, stale-write rejection and origin rejection.');
