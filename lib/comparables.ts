export type Comparable={id:string;kind:'Venta'|'Renta';status:'Vendido'|'Listado'|'Rentado';address:string;amount:number|null;eventDate:string;observedAt:string;sqft:number|null;condition:string;distance:number|null;source:string;url:string;adjustment:number;adjustmentReason:string;selected:boolean};
export type MarketAnalysis={comparables:Comparable[];arv:number|null;rent:number|null;arvReason:string;rentReason:string;staleDays:number};
export type MarketSnapshot={at:string;actor:string;subjectSqft:number;analysis:MarketAnalysis};
export function emptyAnalysis():MarketAnalysis{return {comparables:[],arv:null,rent:null,arvReason:'',rentReason:'',staleDays:180};}
export function newComparable(kind:'Venta'|'Renta'):Comparable{return {id:crypto.randomUUID(),kind,status:'Listado',address:'',amount:null,eventDate:'',observedAt:'',sqft:null,condition:'',distance:null,source:'',url:'',adjustment:0,adjustmentReason:'',selected:false};}
export function validDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;}
export function adjusted(c:Comparable){return c.amount==null?null:Math.round((c.amount+c.adjustment)*100)/100;}
export function missingComparable(c:Comparable){return [!c.address.trim()&&'dirección',!(c.amount!=null&&c.amount>0)&&'precio/renta',!c.eventDate&&'fecha del evento',!c.observedAt&&'fecha de consulta',!(c.sqft!=null&&c.sqft>0)&&'área',!c.condition.trim()&&'condición',c.distance==null&&'distancia',!c.source.trim()&&'fuente',c.adjustment!==0&&!c.adjustmentReason.trim()&&'motivo del ajuste'].filter(Boolean) as string[];}
export function comparableWarnings(c:Comparable,days=180,now=Date.now()){
 const warnings:string[]=[];const missing=missingComparable(c);if(missing.length)warnings.push('Falta: '+missing.join(', '));
 if(c.status==='Listado')warnings.push('Precio solicitado; no acredita una transacción cerrada.');
 if(c.eventDate&&now-Date.parse(c.eventDate)>days*86400000)warnings.push(`Evento con más de ${days} días.`);
 if(c.observedAt&&now-Date.parse(c.observedAt)>days*86400000)warnings.push(`Fuente sin actualizar por más de ${days} días.`);
 return warnings;
}
export function comparableSummary(a:MarketAnalysis,kind:Comparable['kind'],subjectSqft:number){
 const selected=a.comparables.filter(c=>c.kind===kind&&c.selected),usable=selected.filter(c=>!missingComparable(c).length&&adjusted(c)!>0);
 const mean=usable.length?usable.reduce((s,c)=>s+adjusted(c)!,0)/usable.length:null;
 const perSqft=usable.length?usable.reduce((s,c)=>s+adjusted(c)!/c.sqft!,0)/usable.length:null;
 return {count:selected.length,usable:usable.length,mean,low:usable.length?Math.min(...usable.map(c=>adjusted(c)!)):null,high:usable.length?Math.max(...usable.map(c=>adjusted(c)!)):null,perSqft,indicated:perSqft!=null&&subjectSqft>0?perSqft*subjectSqft:null};
}
export function validateAnalysis(a:MarketAnalysis,at=new Date().toISOString()){
 if(!a||!Array.isArray(a.comparables)||a.comparables.length>60||!Number.isInteger(a.staleDays)||a.staleDays<30||a.staleDays>730)throw Error('Revise comparables y umbral de antigüedad (30 a 730 días; máximo 60 comparables).');
 const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
 const numeric=(v:unknown,max=1e9)=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
 const ids=new Set<string>();
 for(const c of a.comparables){
  if(!c||!text(c.id,80)||!c.id||ids.has(c.id)||!['Venta','Renta'].includes(c.kind)||!(c.kind==='Venta'?['Vendido','Listado']:['Rentado','Listado']).includes(c.status)||typeof c.selected!=='boolean')throw Error('Comparable inválido o repetido.');ids.add(c.id);
  if(!text(c.address,250)||!text(c.condition,1000)||!text(c.source,500)||!text(c.url,1500)||!text(c.adjustmentReason,1500))throw Error('Revise los textos del comparable.');
  if(!numeric(c.amount)||!numeric(c.sqft)||!numeric(c.distance,10000)||typeof c.adjustment!=='number'||!Number.isFinite(c.adjustment)||Math.abs(c.adjustment)>1e9||c.amount!=null&&adjusted(c)!<=0)throw Error('Revise importes, áreas, distancias y ajustes del comparable.');
  for(const d of [c.eventDate,c.observedAt])if(typeof d!=='string'||d!==''&&(!validDate(d)||d>at.slice(0,10)))throw Error('Las fechas de comparables deben ser reales, hoy o anteriores.');
  if(c.url){let url;try{url=new URL(c.url);}catch{throw Error('Enlace de fuente inválido.');}if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Usa un enlace público HTTP o HTTPS sin credenciales.');}
  if(c.adjustment&&!c.adjustmentReason.trim())throw Error('Explica el ajuste del comparable.');
 }
 if(!numeric(a.arv)||!numeric(a.rent)||!text(a.arvReason,3000)||!text(a.rentReason,3000))throw Error('Revise ARV, renta y justificaciones.');
 for(const [kind,target,reason] of [['Venta',a.arv,a.arvReason],['Renta',a.rent,a.rentReason]] as const){
  if(target!=null){if(target<=0)throw Error('El objetivo debe ser mayor que cero o quedar vacío.');const selected=a.comparables.filter(c=>c.kind===kind&&c.selected);if(!selected.length||selected.some(c=>missingComparable(c).length)||!reason.trim())throw Error(`Para fijar ${kind==='Venta'?'ARV':'renta'}, selecciona comparables completos y justifica la conclusión.`);}
 }return a;
}
