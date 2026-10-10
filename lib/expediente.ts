import { counties, fields, type Property } from './model';
import {validateAnalysis} from './comparables';
import {validateInvestment} from './investment';

export const stages=['Sin clasificar','Oportunidad','Análisis','Oferta','Contrato','Adquirida','Obra','Lista para comercializar','En venta','Vendida','Refinanciamiento','En renta','Archivada'] as const;
export type Stage=typeof stages[number];
export type Workflow={stage:Stage;responsible:string;planB:boolean;previousStage?:Stage};
export type WorkflowEvent={at:string;actor:string;date:string;reason:string;before:Workflow|null;after:Workflow};
export type DataEvent={at:string;actor:string;source:'Manual'|'Importación anterior'|'Inicial';queriedAt?:string;field:string;before:string|number|null;after:string|number|null};
export const extraFields=[{key:'fullBaths',label:'Baños completos reportados',unit:'baños'},{key:'partialBaths',label:'Baños parciales reportados',unit:'baños'},{key:'yearBuilt',label:'Año de construcción',unit:'año'},{key:'lotSqft',label:'Área del lote',unit:'sqft'}];
export const identityLabels:Record<string,string>={name:'Nombre',county:'Condado',apn:'APN','5':'Dirección','6':'Ciudad','7':'Código postal','8':'Área habitable (sqft)','9':'Habitaciones','12':'Medios baños','13':'Niveles',...Object.fromEntries(extraFields.map(f=>[f.key,f.label]))};
export function workflow(p:Property):Workflow{return p.workflow??{stage:p.updatedAt?'Sin clasificar':'Oportunidad',responsible:'',planB:false};}
export function normalizedApn(apn:string){return apn.toUpperCase().replace(/[\s-]/g,'');}
export function duplicates(p:Property,list:Property[]){const apn=normalizedApn(p.apn);return apn?list.filter(x=>x.id!==p.id&&x.county===p.county&&normalizedApn(x.apn)===apn):[];}
export function fieldValue(p:Property,key:string):string|number|null{return ['name','county','apn'].includes(key)?p[key as 'name'|'county'|'apn']:p.values[key]??null;}
export function setField(p:Property,key:string,value:string|number|null){if(['name','county','apn'].includes(key)){p[key as 'name'|'county'|'apn']=String(value??'');}else p.values[key]=value;}

// Histories and source attribution are assembled from the saved row on the server.
// Client-supplied histories are never used as evidence.
export function prepareExpediente(input:Property,previous:Property|null,uid:string,at:string){
 const p=structuredClone(input);
 delete p.execution;
 p.operations=structuredClone(previous?.operations);
 if(typeof p.county!=='string'||!Object.hasOwn(counties,p.county)||typeof p.apn!=='string'||p.apn.length>80)throw Error('Revise condado y APN.');
 for(const f of extraFields){const v=p.values[f.key];if(v!=null&&v!==''&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e9))throw Error('Revise '+f.label);}
 for(const k of ['5','6','7'])if(typeof p.values[k]!=='string'||String(p.values[k]).length>250)throw Error('Revise dirección, ciudad y código postal.');
 const old=previous?workflow(previous):null;
 const requested=p.workflow??old??workflow(p);
 const next:Workflow={stage:requested.stage,responsible:requested.responsible,planB:requested.planB};
 if(!stages.includes(next.stage)||typeof next.responsible!=='string'||next.responsible.length>150||typeof next.planB!=='boolean')throw Error('Etapa o responsable inválido.');
 next.responsible=next.responsible.trim();
 next.previousStage=old?.previousStage;
 if(next.stage==='Archivada'&&old?.stage!=='Archivada')next.previousStage=old?.stage??'Oportunidad';
 const changed=!old||old.stage!==next.stage||old.responsible!==next.responsible||old.planB!==next.planB;
 p.workflowHistory=previous?.workflowHistory??[];
 if(changed){
  const edit=p.workflowEdit;
  if(!next.responsible||!edit?.reason?.trim()||edit.reason.length>1000)throw Error('Indica responsable y motivo del cambio en la pestaña Expediente.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(edit.date)||!Number.isFinite(Date.parse(edit.date))||new Date(edit.date).toISOString().slice(0,10)!==edit.date||edit.date>at.slice(0,10))throw Error('La fecha del cambio debe ser una fecha real, hoy o anterior.');
  p.workflowHistory=[...p.workflowHistory,{at,actor:uid,date:edit.date,reason:edit.reason.trim(),before:old,after:structuredClone(next)}];
 }
 p.workflow=next;delete p.workflowEdit;
 p.dataHistory=structuredClone(previous?.dataHistory??[]);
 for(const key of Object.keys(identityLabels)){
  const before=previous?fieldValue(previous,key):null,after=fieldValue(p,key);
  const initial=!previous&&['8','9','12','13'].includes(key)&&fields.find(f=>f.key===key)?.initial===after;
  if(before!==after)p.dataHistory.push({at,actor:uid,source:initial?'Inicial':'Manual',field:key,before,after});
 }
 p.marketAnalysis=p.marketAnalysis??previous?.marketAnalysis;
 p.marketHistory=structuredClone(previous?.marketHistory??[]);
 if(p.marketAnalysis){validateAnalysis(p.marketAnalysis,at);if(JSON.stringify(p.marketAnalysis)!==JSON.stringify(previous?.marketAnalysis)||p.values['8']!==previous?.values['8'])p.marketHistory.push({at,actor:uid,subjectSqft:Number(p.values['8']),analysis:structuredClone(p.marketAnalysis)});}
 p.investment=p.investment??previous?.investment;if(p.investment){if(p.operations?.closing){p.investment.purchase=p.operations.closing.price;p.investment.purchaseDate=p.operations.closing.date;const c=p.operations.closing,inv=p.investment;inv.loan.type=c.lender>0?'Hard money':'Efectivo';if(c.lender>0){const original=c.before.investment.financing?.quotes.find(q=>q.id===c.loanId);if(!inv.financing&&original)inv.financing={selectedId:c.loanId,quotes:[structuredClone(original)]};if(inv.financing){inv.financing.selectedId=c.loanId;if(!inv.financing.quotes.some(q=>q.id===c.loanId)&&original)inv.financing.quotes.push(structuredClone(original));}}if(inv.cash){inv.cash.opening=0;inv.cash.earnest=c.earnest;inv.cash.earnestDate=c.earnestDate;inv.cash.contributions=[{id:c.id+'-deposit',date:c.earnestDate,amount:c.earnest,note:'Depósito real de adquisición'},{id:c.id+'-capital',date:c.date,amount:c.capital,note:'Capital real de cierre'},...inv.cash.contributions.filter(x=>x.date>c.date)];}}validateInvestment(p.investment);}
 p.rehab=p.rehab??previous?.rehab;
 return p;
}
