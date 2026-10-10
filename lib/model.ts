import type {Execution} from './accounting';
import type {Operations} from './operations';
import data from './catalog.json';
import type {Investment} from './investment';
import type {Workflow,WorkflowEvent,DataEvent} from './expediente';
import type {MarketAnalysis,MarketSnapshot} from './comparables';
export const catalog=data.catalog;
export const fields=data.fields;
export type Line={selected?:boolean;qty?:number|null;price?:number|null;actual?:number|null;note?:string};
export type Property={execution?:Execution;operations?:Operations;investment?:Investment;rehab?:{mode:'Detallada'|'Rápida'|'Manual';rate:number|null;manual:number|null;overlapReviewed:boolean};marketAnalysis?:MarketAnalysis;marketHistory?:MarketSnapshot[];id:string;name:string;county:string;apn:string;values:Record<string,string|number|null>;lines:Record<string,Line>;costs:{name:string;amount:number;period:string}[];updatedAt?:string;workflow?:Workflow;workflowEdit?:{date:string;reason:string};workflowHistory?:WorkflowEvent[];dataHistory?:DataEvent[];};
export const counties:Record<string,string>={Barrow:'13013',Bartow:'13015',Butts:'13035',Carroll:'13045',Cherokee:'13057',Clayton:'13063',Cobb:'13067',Coweta:'13077',Dawson:'13085',DeKalb:'13089',Douglas:'13097',Fayette:'13113',Forsyth:'13117',Fulton:'13121',Gwinnett:'13135',Haralson:'13143',Heard:'13149',Henry:'13151',Jasper:'13159',Lamar:'13171',Meriwether:'13199',Morgan:'13211',Newton:'13217',Paulding:'13223',Pickens:'13227',Pike:'13231',Rockdale:'13247',Spalding:'13255',Walton:'13297',Hall:'13139',Jackson:'13157'};
export function fresh():Property {const values=Object.fromEntries(fields.map(f=>[f.key,f.initial]));values['5']='';values['6']='Atlanta';values['7']='';return {id:crypto.randomUUID(),name:'Nueva propiedad',county:'Fulton',apn:'',values,lines:{},costs:['Impuesto inmobiliario','Seguro de propiedad / obra','HOA / condominio','Electricidad, agua y gas','Basura / alcantarillado','Jardín y plagas','Intereses / pago de préstamo','Seguridad / internet','Cierre / originación','Conexiones / depósitos','Otros gastos de tenencia'].map((name,i)=>({name,amount:0,period:i<2?'Anual':i===8||i===9?'Único':'Mensual'}))};}
export function n(p:Property,key:string):number{return Number(p.values[key]??0);}
// Only the fixed catalog's arithmetic is parsed. No JavaScript evaluation.
export function quantity(expr:string,p:Property):number {
const expanded=expr.replace(/'Propiedad'!B(\d+)/g,(_,k)=>String(k==='45'?(p.values['26']!==null&&p.values['26']!==''?n(p,'26'):n(p,'8')/Math.max(1,n(p,'13'))*n(p,'25')):k==='46'?n(p,'10')+n(p,'11')+n(p,'12'):n(p,k)));
const tokens=expanded.match(/\d+(?:\.\d+)?|[()+*/-]/g)||[];let i=0;
function atom():number{const t=tokens[i++];if(t==='('){const v=sum();if(tokens[i++]!==')')throw Error('Cantidad inválida');return v;}if(t==='-')return -atom();return Number(t);}
function mul():number{let v=atom();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],r=atom();v=op==='*'?v*r:v/r;}return v;}
function sum():number{let v=mul();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],r=mul();v=op==='+'?v+r:v-r;}return v;}
return sum();}
export function lineTotal(p:Property,item:typeof catalog[number]){const l=p.lines[item.id]||{};const qty=l.qty??quantity(item.qty,p);const active=!!l.selected&&(!item.mode||item.mode===p.values['38']);const factor=n(p,'39');const missing=active&&l.price==null&&item.lo==null;const low=l.price??(item.lo==null?0:item.lo*factor);const high=l.price??(item.hi==null?0:item.hi*factor);const round=(v:number)=>Math.round(v*100)/100;return {qty,active,missing,low:active?round(qty*low):0,mid:active?round(qty*(low+high)/2):0,high:active?round(qty*high):0,price:(low+high)/2,actual:(l.actual??0)+(p.execution?.byLine[item.id]??0)-(p.execution?.included[item.id]??0)};}
export function totals(p:Property){
 const lines=catalog.map(c=>lineTotal(p,c));
 const detail=lines.reduce((a,l)=>({low:a.low+l.low,mid:a.mid+l.mid,high:a.high+l.high,actual:a.actual+l.actual,missing:a.missing+Number(l.missing),count:a.count+Number(l.active)}),{low:0,mid:0,high:0,actual:0,missing:0,count:0});
 const mode=p.rehab?.mode??'Detallada';const input=mode==='Rápida'?p.rehab?.rate:mode==='Manual'?p.rehab?.manual:null;
 const amount=mode==='Rápida'?n(p,'8')*(input??0):input??0;
 const base=mode==='Detallada'?detail:{...detail,low:amount,mid:amount,high:amount,missing:Number(input==null),count:0};
 const holding=p.costs.reduce((s,c)=>s+(c.period==='Único'?c.amount:c.period==='Anual'?c.amount/12*n(p,'35'):c.amount*n(p,'35')),0);
 const fee=base.mid*n(p,'37');const contingency=(base.mid+fee)*n(p,'36');
 const total=(b:number)=>Math.round((b*(1+n(p,'37'))*(1+n(p,'36'))+n(p,'41')+holding)*100)/100;
 return {...base,detailMid:detail.mid,mode,fee,contingency,holding,total:total(base.mid),totalLow:total(base.low),totalHigh:total(base.high)};
}
export function overlapWarnings(p:Property){
 const has=(id:string)=>lineTotal(p,catalog.find(c=>c.id===id)!).active;
 const messages:string[]=[];
 for(const [a,b,label] of [['21','22','Gabinetes nuevos y pintura de gabinetes'],['47','48','Dos tipos de calentador'],['51','52','Servicio y reemplazo HVAC'],['17','18','Madera nueva y restauración de madera']])if(has(a)&&has(b))messages.push(label+': confirma que son áreas o alcances diferentes.');
 if(p.values['38']==='Paquete'&&['28','29','30'].some(has))messages.push('Paquetes de baños: revisa pintura, demolición, electricidad y plomería incluidos.');
 if(has('1'))messages.push('La inspección ya está en el catálogo; evita repetirla en adquisición.');
 if(has('3'))messages.push('Los permisos ya están en el catálogo; evita repetirlos en costos del proyecto.');
 return messages;
}

export function validateProperty(p:Property){if(p?.rehab){if(!['Detallada','Rápida','Manual'].includes(p.rehab.mode)||typeof p.rehab.overlapReviewed!=='boolean')throw Error('Modo de estimación inválido');for(const v of [p.rehab.rate,p.rehab.manual])if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e9))throw Error('Revise la estimación de obra');}if(!p||typeof p.id!=='string'||p.id.length>80||typeof p.name!=='string'||p.name.length>180||!p.values||!p.lines||!Array.isArray(p.costs)||p.costs.length>30)throw Error('Propiedad inválida');for(const f of fields){if(typeof f.initial==='number'||f.key==='26'){const v=p.values[f.key];if(v==null||v===''){if(f.key==='26')continue;throw Error('Complete '+f.label);}if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e9)throw Error('Revise '+f.label);}}if(n(p,'13')<1)throw Error('Debe haber al menos un nivel');if(!['Detalle','Paquete'].includes(String(p.values['38'])))throw Error('Modo de baños inválido');for(const l of Object.values(p.lines)){for(const v of [l.qty,l.price,l.actual])if(v!=null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e9))throw Error('Cantidad o precio inválido');}for(const c of p.costs)if(typeof c.amount!=='number'||!Number.isFinite(c.amount)||c.amount<0||!['Mensual','Anual','Único'].includes(c.period))throw Error('Gasto de tenencia inválido');return p;}
