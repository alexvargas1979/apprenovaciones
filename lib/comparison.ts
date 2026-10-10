import {calculateFlip,type Investment} from './investment';
import {daysBetween,monthAfter,newCashPlan} from './financing';
import {rentalResult} from './plan-b';
import {validDate} from './comparables';
import type {Property} from './model';
export type Comparison={end:string;appreciation:number;rentGrowth:number;costGrowth:number;saleRate:number;saleFixed:number;capexRecovery:number;escrowRecovery:number};
export const newComparison=(a:Investment):Comparison=>({end:monthAfter(a.planBDetails?.refi.date||a.saleDate,60),appreciation:0,rentGrowth:0,costGrowth:0,saleRate:.06,saleFixed:0,capexRecovery:0,escrowRecovery:0});
export function validateComparison(c:Comparison|undefined){if(!c)return;const n=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;if(!validDate(c.end)||![c.appreciation,c.rentGrowth,c.costGrowth].every(v=>n(v,-.9,1))||!n(c.saleRate,0,1)||!n(c.saleFixed,0,1e9)||!n(c.capexRecovery,0,1)||!n(c.escrowRecovery,0,1e9))throw Error('Revise horizonte y supuestos de comparación.');}
export type Flow={date:string;name:string;amount:number};
export function xirr(flows:Flow[]){const grouped=new Map<string,number>();for(const f of flows){if(!validDate(f.date)||!Number.isFinite(f.amount))return {value:null,reason:'Flujos inválidos'};grouped.set(f.date,(grouped.get(f.date)??0)+f.amount);}const xs=[...grouped].sort(([a],[b])=>a.localeCompare(b)).filter(([,v])=>Math.abs(v)>1e-8);
 if(!xs.some(([,v])=>v<0)||!xs.some(([,v])=>v>0))return {value:null,reason:'Sin cambio de signo'};if(xs[0][0]===xs.at(-1)![0])return {value:null,reason:'Sin plazo'};
 const changes=xs.slice(1).filter((x,i)=>Math.sign(x[1])!==Math.sign(xs[i][1])).length;if(changes!==1)return {value:null,reason:'No se verifica solución única: múltiples cambios de signo'};
 const npv=(z:number)=>xs.reduce((s,[date,v])=>s+v*Math.exp(-z*daysBetween(xs[0][0],date)/365),0);let lo=-13.8155105579,hi=13.8155115579,l=npv(lo),h=npv(hi);if(!Number.isFinite(l)||!Number.isFinite(h)||l*h>0)return {value:null,reason:'Sin raíz en el intervalo verificable'};
 for(let i=0;i<160;i++){const mid=(lo+hi)/2,m=npv(mid);if(Math.sign(m)===Math.sign(l)){lo=mid;l=m;}else hi=mid;}return {value:Math.expm1((lo+hi)/2),reason:'Única para flujos con un cambio de signo'};
}
export function investorLedger(flows:Flow[],end:string){const dates=new Map<string,Flow[]>();for(const f of flows){if(!dates.has(f.date))dates.set(f.date,[]);dates.get(f.date)!.push(f);}if(!dates.has(end))dates.set(end,[]);let cash=0,capital=0,peak=0;const investor:Flow[]=[];
 const ledger=[...dates].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>{const net=items.reduce((s,x)=>s+x.amount,0);cash+=net;const contribution=Math.max(0,-cash);if(contribution){capital+=contribution;cash+=contribution;investor.push({date,name:'Aporte requerido',amount:-contribution});}peak=Math.max(peak,capital);const distribution=date===end?cash:0;if(distribution){investor.push({date,name:'Distribución final',amount:distribution});cash=0;}return {date,items,net,contribution,distribution,balance:cash};});
 const distribution=ledger.reduce((s,x)=>s+x.distribution,0);return {ledger,investor,capital,peak,distribution,profit:distribution-capital,xirr:xirr(investor)};
}
export function compareExits(p:Property,a:Investment,c:Comparison){const errors:string[]=[];try{validateComparison(c);}catch(e){errors.push((e as Error).message);}if(!a.purchaseDate||c.end<a.saleDate||daysBetween(a.purchaseDate,c.end)>3653)errors.push('El horizonte debe cubrir venta y compra, hasta 10 años.');
 const common={...(a.cash??newCashPlan(a.purchaseDate,c.end)),end:c.end,opening:0,contributions:[]};
 const flip=calculateFlip(p,{...a,cash:{...common,exit:'Venta'}}),saleFlows:Flow[]=flip.cash.ledger.flatMap(x=>x.items.map(z=>({date:x.date,name:z.name,amount:z.amount}))),sale=investorLedger(saleFlows,c.end);
 const input=a.planBDetails;if(!input)return {errors:[...errors,'Completa Renta y Refinanciamiento'],sale:{...sale,margin:flip.arv>0?sale.profit/flip.arv:null},rental:null};
 const result=calculateFlip(p,{...a,cash:{...common,exit:'Refinanciamiento'}}),b=result.fullPlanB!,conversion=input.refi.date;
 if(c.end<=conversion)errors.push('Horizonte posterior a la conversión');if(c.escrowRecovery>input.refi.escrow)errors.push('Recuperación de escrow superior al depósito inicial');
 const flows:Flow[]=result.cash.ledger.flatMap(x=>x.items.filter(z=>z.kind!=='Capital').map(z=>({date:x.date,name:z.name,amount:z.amount})));
 // Comparison is a labeled hypothetical scenario; it cannot authorize bank cash in HU-12.
 const projectedProceeds=b.principal;flows.push({date:conversion,name:'Financiamiento hipotético adicional para comparar',amount:projectedProceeds-b.availableProceeds});
 const investedAtConversion=Math.max(0,-flows.filter(x=>x.date<=conversion).reduce((s,x)=>s+x.amount,0));
 let operating=0,capex=0,firstYearCash=0,previous=conversion;const years=Math.max(0,daysBetween(conversion,c.end)/365);
 for(let m=1;m<=120&&previous<c.end;m++){const date=monthAfter(conversion,m)<c.end?monthAfter(conversion,m):c.end,duration=daysBetween(previous,date)*12/365,growth=Math.pow(1+c.rentGrowth,daysBetween(conversion,previous)/365),costGrowth=Math.pow(1+c.costGrowth,daysBetween(conversion,previous)/365),r={...input.rental,units:input.rental.units.map(u=>({...u,rent:u.rent===null?null:u.rent*growth})),otherIncome:input.rental.otherIncome*growth,taxAnnual:input.rental.taxAnnual*costGrowth,insuranceAnnual:input.rental.insuranceAnnual*costGrowth,hoa:input.rental.hoa*costGrowth,utilities:input.rental.utilities*costGrowth,other:input.rental.other*costGrowth},v=rentalResult(r,0,previous>=b.loan.maturity?0:input.refi.mortgageInsurance),net=v.cash*duration;
  flows.push({date,name:'Operación de renta tras CapEx y seguro hipotecario',amount:net});operating+=v.effective*duration;capex+=v.reserve*duration;if(date<=monthAfter(conversion,12))firstYearCash+=net;previous=date;}
 let amortized=0,interest=0;for(const row of b.loan.rows.filter(x=>x.date<=c.end)){flows.push({date:row.date,name:'Cuota de hipoteca · P&I',amount:-row.payment});amortized+=row.principal;interest+=row.interest;if(row.date<=monthAfter(conversion,12))firstYearCash-=row.payment;}
 let balance=Math.max(0,b.principal-amortized);if(b.loan.balloon>0&&b.loan.maturity<c.end){flows.push({date:b.loan.maturity,name:'Pago global al vencimiento (sin renovación supuesta)',amount:-b.loan.balloon});balance=0;}
 const initialValue=input.refi.appraisal??0,value=initialValue*Math.pow(1+c.appreciation,years),selling=value*c.saleRate+c.saleFixed;
 flows.push({date:c.end,name:'Venta al horizonte',amount:value},{date:c.end,name:'Costos de venta final',amount:-selling},{date:c.end,name:'Principal hipotecario a cancelar',amount:-balance},{date:c.end,name:'Recuperación supuesta de escrow y CapEx no consumido',amount:c.escrowRecovery+capex*c.capexRecovery});
 const rental=investorLedger(flows,c.end),revenue=value+operating;
 return {errors:[...new Set([...errors,...flip.missing,...result.missing])],sale:{...sale,margin:flip.arv>0?sale.profit/flip.arv:null},rental:{...rental,margin:revenue>0?rental.profit/revenue:null,value,appreciation:value-initialValue,amortized,interest,balance,investedAtConversion,cashOnCash:investedAtConversion>0?firstYearCash/investedAtConversion:null,firstYearCash,capex,refiStatus:b.status,conditional:!b.confirmed,conditions:[...b.missing,...b.failures,...b.conditions],revenue}};
}
