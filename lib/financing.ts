import {validDate} from './comparables';
export const quoteStates=['Estimación','Cotización','Aprobación','Préstamo firmado'] as const;
export type LoanEvent={id:string;date:string;kind:'Draw'|'Principal'|'Interés'|'Capitalización';amount:number;base:'USD'|'Reserva %';delayDays:number;note:string};
export type LoanQuote={id:string;lender:string;status:typeof quoteStates[number];validUntil:string;maximum:number;committed:number;advance:number;rehabReserve:number;financedFees:number;financedRetention:number;retention:number;
 ltc:number;ltcBase:'Compra + obra'|'Compra + obra + cargos';ltv:number;ltvBase:'Compra'|'ARV';points:number;pointsBase:'Compromiso'|'Compra financiada';fees:number;rate:number;dayBasis:360|365;interestBasis:'Utilizado'|'Compromiso';settlement:'Al payoff'|'Mensual pagado'|'Mensual capitalizado'|'Reserva retenida';minimumInterest:number;
 maturity:string;extensions:{id:string;date:string;fee:number;note:string}[];penalty:number;penaltyUntil:string;guarantees:string;events:LoanEvent[];official:{date:string;amount:number|null;reference:string}};
export type Financing={selectedId:string;quotes:LoanQuote[]};
export type CashPlan={start:string;end:string;opening:number;earnest:number;earnestDate:string;construction:{id:string;date:string;share:number}[];contributions:{id:string;date:string;amount:number;note:string}[];exit:'Venta'|'Refinanciamiento';refiProceeds:number;refiConfirmed:boolean;refiReference:string};
export const daysBetween=(a:string,b:string)=>(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000;
export function shiftDays(date:string,days:number){return validDate(date)?new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10):'';}
export function monthAfter(date:string,months:number){if(!validDate(date))return '';const d=new Date(date+'T00:00:00Z'),n=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);d.setUTCDate(Math.min(n,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d.toISOString().slice(0,10);}
export function newQuote(purchase:number,rehab:number,start:string,end:string):LoanQuote{return {id:crypto.randomUUID(),lender:'Nuevo lender',status:'Estimación',validUntil:end,maximum:purchase*.9,committed:purchase*.9,advance:.9,rehabReserve:0,financedFees:0,financedRetention:0,retention:0,ltc:1,ltcBase:'Compra + obra',ltv:1,ltvBase:'ARV',points:.02,pointsBase:'Compromiso',fees:0,rate:.12,dayBasis:365,interestBasis:'Utilizado',settlement:'Al payoff',minimumInterest:0,maturity:end,extensions:[],penalty:0,penaltyUntil:'',guarantees:'',events:[],official:{date:'',amount:null,reference:''}};}
export function newCashPlan(start:string,end:string):CashPlan{return {start,end,opening:0,earnest:0,earnestDate:start,construction:[],contributions:[],exit:'Venta',refiProceeds:0,refiConfirmed:false,refiReference:''};}
export function validateFinancing(f:Financing|undefined,c:CashPlan|undefined){
 const num=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
 const str=(v:unknown,max=200)=>typeof v==='string'&&v.length<=max;
 const date=(v:unknown,blank=true)=>typeof v==='string'&&(blank&&v===''||validDate(v));
 const list=(v:unknown,max:number)=>Array.isArray(v)&&v.length<=max;
 const ids=(xs:{id:string}[])=>xs.every(x=>str(x.id,80)&&!!x.id)&&new Set(xs.map(x=>x.id)).size===xs.length;
 if(f){if(!list(f.quotes,12)||!ids(f.quotes)||!str(f.selectedId,80)||f.selectedId&&!f.quotes.some(q=>q.id===f.selectedId))throw Error('Selección de lender inválida (máximo 12).');
 for(const q of f.quotes){if(!str(q.lender)||!q.lender.trim()||!quoteStates.includes(q.status)||![q.validUntil,q.maturity,q.penaltyUntil,q.official?.date].every(d=>date(d))||![q.maximum,q.committed,q.rehabReserve,q.financedFees,q.financedRetention,q.retention,q.fees,q.minimumInterest,q.penalty].every(v=>num(v))||![q.advance,q.ltc,q.ltv,q.points].every(v=>num(v,1))||!num(q.rate,2)||![360,365].includes(q.dayBasis)||!['Compra + obra','Compra + obra + cargos'].includes(q.ltcBase)||!['Compra','ARV'].includes(q.ltvBase)||!['Compromiso','Compra financiada'].includes(q.pointsBase)||!['Utilizado','Compromiso'].includes(q.interestBasis)||!['Al payoff','Mensual pagado','Mensual capitalizado','Reserva retenida'].includes(q.settlement)||!str(q.guarantees,2000)||!q.official||!(q.official.amount===null||num(q.official.amount))||!str(q.official.reference,500))throw Error('Revise términos, importes y fechas del lender.');
 if(q.official.amount!==null&&(!q.official.date||!q.official.reference.trim()))throw Error('La cotización oficial requiere fecha y referencia.');
 if(!list(q.extensions,24)||!ids(q.extensions)||q.extensions.some(e=>!date(e.date,false)||!num(e.fee)||!str(e.note,500))||new Set(q.extensions.map(e=>e.date)).size!==q.extensions.length)throw Error('Extensiones inválidas o repetidas.');
 if(!list(q.events,120)||!ids(q.events)||q.events.some(e=>!date(e.date,false)||!['Draw','Principal','Interés','Capitalización'].includes(e.kind)||!['USD','Reserva %'].includes(e.base)||e.kind!=='Draw'&&e.base!=='USD'||!num(e.amount,e.base==='Reserva %'?1:1e9)||!num(e.delayDays,730)||!Number.isInteger(e.delayDays)||!str(e.note,500)))throw Error('Movimientos del préstamo inválidos.');
 }}
 if(c){if(![c.start,c.end,c.earnestDate].every(d=>date(d))||![c.opening,c.earnest,c.refiProceeds].every(v=>num(v))||!['Venta','Refinanciamiento'].includes(c.exit)||typeof c.refiConfirmed!=='boolean'||!str(c.refiReference,500)||!list(c.construction,120)||!ids(c.construction)||c.construction.some(x=>!date(x.date,false)||!num(x.share,1))||!list(c.contributions,240)||!ids(c.contributions)||c.contributions.some(x=>!date(x.date,false)||!num(x.amount)||!str(x.note,500)))throw Error('Calendario de caja inválido.');if(c.start&&c.end&&(c.end<c.start||daysBetween(c.start,c.end)>3660))throw Error('El horizonte de caja admite hasta 10 años.');if(c.refiConfirmed&&!c.refiReference.trim())throw Error('Indica la referencia de fondos de refinanciamiento confirmados.');}
}
export type BankFlow={date:string;name:string;amount:number;kind:'Préstamo'|'Interés'|'Principal'|'Cargos'|'Reserva'};
export function projectDebt(q:LoanQuote,purchase:number,rehab:number,arv:number,start:string,end:string,rateDelta=0){
 const initialPurchase=purchase*q.advance,allocated=initialPurchase+q.rehabReserve+q.financedFees+q.financedRetention;
 const origination=(q.pointsBase==='Compromiso'?q.committed:initialPurchase)*q.points+q.fees,initial=initialPurchase+q.financedFees+q.financedRetention;
 const ltcBase=purchase+rehab+(q.ltcBase==='Compra + obra + cargos'?origination:0),ltvBase=q.ltvBase==='Compra'?purchase:arv;
 const warnings:string[]=[],errors:string[]=[];
 if(Math.abs(allocated-q.committed)>.01)errors.push('Compra + reserva de obra + cargos/reserva financiados no concilian con el compromiso.');
 if(q.committed>q.maximum+.01)errors.push('Compromiso superior al importe máximo.');
 if(q.committed>ltcBase*q.ltc+.01)errors.push('Límite LTC excedido.');if(q.committed>ltvBase*q.ltv+.01)errors.push('Límite LTV excedido.');
 if(q.financedFees>origination+.01||q.financedRetention>q.retention+.01)errors.push('Cargos o retención financiados superan sus usos.');
 if(!validDate(start)||!validDate(end)||end<=start)errors.push('Faltan fechas válidas de compra y payoff.');
 if(!q.validUntil||start>q.validUntil)errors.push('Vigencia de términos ausente o anterior a la compra.');
 if(!q.maturity||q.maturity<start)errors.push('Vencimiento contractual inválido.');
 const exts=[...q.extensions].sort((a,b)=>a.date.localeCompare(b.date));let maturity=q.maturity;
 const extensionCharges:{date:string;amount:number}[]=[];
 for(const e of exts){if(e.date<=maturity){errors.push('Cada extensión debe ampliar el vencimiento anterior.');continue;}if(end>maturity)extensionCharges.push({date:maturity,amount:e.fee});maturity=e.date;}
 if(end>maturity)errors.push('Payoff posterior al vencimiento y a las extensiones registradas.');
 const events=q.events.map(e=>({...e,effectiveDate:shiftDays(e.date,e.kind==='Draw'?e.delayDays:0),value:e.base==='Reserva %'?q.rehabReserve*e.amount:e.amount})).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)||a.id.localeCompare(b.id));
 if(events.some(e=>e.date<start))errors.push('Hay movimientos anteriores a la compra.');
 if(events.filter(e=>e.kind==='Draw').reduce((s,e)=>s+e.value,0)>q.rehabReserve+.01)errors.push('Los draws programados superan la reserva de obra.');
 if(events.some(e=>e.effectiveDate>=end))warnings.push('Movimientos en o después del payoff no se ejecutan; la reserva pendiente no es caja.');
 const bank:BankFlow[]=[];const flow=(date:string,name:string,amount:number,kind:BankFlow['kind'])=>{if(amount)bank.push({date,name,amount,kind});};
 let principal=initial,accrued=0,interest=0,paid=0,capitalized=0,amortized=0,drawn=0,retained=q.retention,retainedUsed=0;
 const ledger:{date:string;label:string;days:number;interest:number;draw:number;capitalized:number;principalPaid:number;interestPaid:number;retainedUsed:number;balance:number;accrued:number;retained:number}[]=[];
 flow(start,'Desembolso inicial (compra y usos financiados)',initial,'Préstamo');flow(start,'Puntos y cargos de originación',-origination,'Cargos');flow(start,'Depósito en reserva restringida de interés',-q.retention,'Reserva');
 const dates=new Set<string>([start,end]),monthlyDates=new Set<string>([end]);for(const e of events)if(e.effectiveDate>=start&&e.effectiveDate<end)dates.add(e.effectiveDate);
 if(validDate(start)&&validDate(end))for(let m=1;m<=156;m++){const d=monthAfter(start,m);if(d>=end)break;monthlyDates.add(d);if(q.settlement!=='Al payoff')dates.add(d);}
 let previous=start;const rate=Math.max(0,q.rate+rateDelta);
 for(const date of [...dates].sort()){
  const elapsed=validDate(previous)&&validDate(date)?Math.max(0,daysBetween(previous,date)):0,earned=(q.interestBasis==='Compromiso'?q.committed:principal)*rate*elapsed/q.dayBasis;
  interest+=earned;accrued+=earned;let draw=0,cap=0,pr=0,ip=0,ru=0,minimumApplied=0;const labels:string[]=[];
  const settle=(kind:'Interés'|'Capitalización',requested:number)=>{const amount=Math.min(requested,accrued);if(requested>accrued+.01)errors.push('Pago/capitalización de interés excede lo devengado: '+date);accrued-=amount;if(kind==='Capitalización'){principal+=amount;capitalized+=amount;cap+=amount;}else{paid+=amount;ip+=amount;flow(date,'Pago de interés',-amount,'Interés');}};
  // Same-day order is explicit: scheduled movements by stable id, then monthly settlement.
  for(const e of events.filter(e=>e.effectiveDate===date&&date<end)){labels.push(e.kind+(e.note?' · '+e.note:''));if(e.kind==='Draw'){principal+=e.value;drawn+=e.value;draw+=e.value;flow(date,'Draw / reembolso de obra'+(e.note?' · '+e.note:''),e.value,'Préstamo');}else if(e.kind==='Principal'){const amount=Math.min(principal,e.value);if(e.value>principal+.01)errors.push('Amortización superior al saldo: '+date);principal-=amount;amortized+=amount;pr+=amount;flow(date,'Amortización de principal',-amount,'Principal');}else settle(e.kind,e.value);}
  const monthly=date>start&&monthlyDates.has(date);
  if(date===end&&interest<q.minimumInterest){minimumApplied=q.minimumInterest-interest;interest+=minimumApplied;accrued+=minimumApplied;labels.push('Mínimo contractual +'+minimumApplied.toFixed(2));}
  if(monthly){if(q.settlement==='Mensual pagado')settle('Interés',accrued);if(q.settlement==='Mensual capitalizado')settle('Capitalización',accrued);if(q.settlement==='Reserva retenida'){ru=Math.min(retained,accrued);retained-=ru;retainedUsed+=ru;accrued-=ru;labels.push('Aplicación de reserva retenida');}}
  if(principal>q.committed+.01)warnings.push('Saldo utilizado supera el compromiso (incluye capitalización): '+date);
  ledger.push({date,label:labels.join(' / ')|| (date===start?'Saldo inicial':date===end?'Liquidación estimada':'Interés del período'),days:elapsed,interest:earned+minimumApplied,draw,capitalized:cap,principalPaid:pr,interestPaid:ip,retainedUsed:ru,balance:principal,accrued,retained});previous=date;
 }
 const penalty=q.penaltyUntil&&end<q.penaltyUntil?q.penalty:0,fees=origination+extensionCharges.reduce((s,e)=>s+e.amount,0)+penalty;
 for(const e of extensionCharges)flow(e.date,'Cargo de extensión',-e.amount,'Cargos');flow(end,'Penalidad de prepago',-penalty,'Cargos');
 const payoff=principal+accrued;flow(end,'Payoff: principal estimado',-principal,'Principal');flow(end,'Payoff: interés pendiente',-accrued,'Interés');flow(end,'Liberación de reserva retenida sobrante',retained,'Reserva');
 const officialDifference=q.official.amount!==null&&q.official.date===end?q.official.amount-(payoff+penalty):null;
 return {allocated,initial,initialPurchase,commitment:q.committed,origination,fees,ltc:ltcBase?q.committed/ltcBase:null,ltv:ltvBase?q.committed/ltvBase:null,drawn,undrawn:Math.max(0,q.rehabReserve-drawn),interest,paid,retainedUsed,retained,capitalized,amortized,principal,accrued,payoff,penalty,officialDifference,bank,ledger,errors:[...new Set(errors)],warnings:[...new Set(warnings)],reconciliation:initial+drawn+capitalized-amortized-principal};
}

type CostFlow={name:string;total:number;resolvedDate:string;resolvedEnd:string;recurring:boolean};
export function projectCash(c:CashPlan,start:string,end:string,purchase:number,rehab:number,arv:number,costs:CostFlow[],debt:ReturnType<typeof projectDebt>|null,legacyLoan:BankFlow[]=[],refiClosing=0){
 const errors:string[]=[],warnings:string[]=[],flows:{date:string;name:string;amount:number;kind:string;contribution:boolean}[]=[];
 const add=(date:string,name:string,amount:number,kind:string,contribution=false)=>{if(amount)flows.push({date,name,amount,kind,contribution});};
 if(!validDate(c.start)||!validDate(c.end)||c.start>start||c.end<end)errors.push('El horizonte de caja debe cubrir compra y salida.');
 if(c.earnest>purchase+.01)errors.push('Earnest money supera el precio de compra.');
 if(c.earnest&&(!validDate(c.earnestDate)||c.earnestDate>start||c.earnestDate<c.start))errors.push('Fecha de earnest money fuera del período previo al cierre.');
 add(c.earnestDate,'Earnest money entregado',-c.earnest,'Adquisición');add(start,'Compra menos earnest money acreditado',-(purchase-c.earnest),'Adquisición');
 if(c.construction.length){if(Math.abs(c.construction.reduce((s,x)=>s+x.share,0)-1)>.000001)errors.push('Los pagos de obra deben distribuir el 100% del presupuesto.');for(const x of c.construction){if(x.date<start||x.date>=end)errors.push('Pago de obra fuera del período de ejecución.');add(x.date,'Pago previsto de obra',-rehab*x.share,'Obra');}}
 else{add(start,'Obra total prevista (distribuye pagos para afinar liquidez)',-rehab,'Obra');warnings.push('Sin distribución de obra: se reserva el 100% de su costo al cierre.');}
 for(const x of costs){if(!x.recurring){add(x.resolvedDate,x.name,-x.total,'Costo');continue;}const length=daysBetween(x.resolvedDate,x.resolvedEnd);if(!(length>0))continue;let last=x.resolvedDate;for(let m=1;m<=156&&last<x.resolvedEnd;m++){const next=monthAfter(x.resolvedDate,m),date=next<x.resolvedEnd?next:x.resolvedEnd;add(date,x.name,-x.total*daysBetween(last,date)/length,'Costo');last=date;}}
 for(const x of debt?.bank??legacyLoan)add(x.date,x.name,x.amount,x.kind);
 for(const x of c.contributions){if(x.date<c.start||x.date>c.end)errors.push('Aporte fuera del horizonte.');add(x.date,'Aporte · '+x.note,x.amount,'Capital',true);}
 if(c.exit==='Venta')add(end,'Ingreso por venta',arv,'Venta');else{add(end,'Costos de refinanciamiento',-refiClosing,'Conversión');if(c.refiConfirmed)add(end,'Desembolso de refinanciamiento confirmado por usuario',c.refiProceeds,'Conversión');else warnings.push('Refinanciamiento pendiente: no se acredita su importe en la caja disponible. Completa y revisa la evaluación en Refinanciamiento.');}
 const byDate=new Map<string,typeof flows>();for(const x of flows){if(!validDate(x.date)||x.date<c.start||x.date>c.end)errors.push('Movimiento fuera del horizonte: '+x.name);if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date)!.push(x);}
 let before=c.opening,after=c.opening,peakGap=0,remainingGap=0,totalContributions=0;let peakDate=c.start;
 const ledger=[...byDate.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>{const operating=items.filter(x=>!x.contribution).reduce((s,x)=>s+x.amount,0),contribution=items.filter(x=>x.contribution).reduce((s,x)=>s+x.amount,0);before+=operating;after+=operating+contribution;totalContributions+=contribution;if(-before>peakGap){peakGap=-before;peakDate=date;}remainingGap=Math.max(remainingGap,-after);return {date,items,sources:items.filter(x=>x.amount>0&&!x.contribution).reduce((s,x)=>s+x.amount,0),uses:-items.filter(x=>x.amount<0).reduce((s,x)=>s+x.amount,0),contribution,before,after};});
 return {ledger,peakGap,peakDate,remainingGap,ending:after,beforeContributions:before,totalContributions,errors:[...new Set(errors)],warnings,exit:c.exit};
}
