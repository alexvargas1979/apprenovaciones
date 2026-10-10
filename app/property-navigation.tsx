'use client';
import type {ReactNode} from 'react';
import {ChevronDown,Check} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
export const propertyNavigation=[
 {label:'Propiedad',items:[['expediente','Expediente y etapa'],['datos','Datos del inmueble'],['documentos','Documentos']]},
 {label:'Análisis',items:[['comparables','Comparables de venta y renta'],['inversion','Análisis de inversión'],['escenarios','Escenarios guardados'],['estres','Oferta máxima y estrés']]},
 {label:'Compra y crédito',items:[['compra','Adquisición y diligencia'],['financiamiento','Préstamo hard money'],['caja','Caja y capital'],['refi','Refinanciamiento']]},
 {label:'Remodelación',items:[['reparaciones','Alcance y reparaciones'],['tenencia','Gastos y reserva'],['presupuesto','Presupuesto aprobado'],['contabilidad','Gastos, catálogos y pagos']]},
 {label:'Venta y renta',items:[['ejecucion','Cronograma y comercialización'],['renta','Plan de renta'],['comparacion','Comparar salidas'],['ciclo','Cierres y operación de renta']]},
 {label:'Resultados',items:[['gestion','Desempeño y auditoría'],['reportes','Reportes descargables'],['resumen','Resumen por categoría']]},
];
export function PropertyNavigation({active,onSelect,disabled=false}:{active:string;onSelect:(value:string)=>void;disabled?:boolean}){return <nav className="property-navigation" aria-label="Secciones de la propiedad">{propertyNavigation.map(group=><DropdownMenu key={group.label}><DropdownMenuTrigger className="property-menu-trigger" data-current={group.items.some(([id])=>id===active)||undefined} disabled={disabled}>{group.label}<ChevronDown size={16}/></DropdownMenuTrigger><DropdownMenuContent className="property-menu-popup" align="start" sideOffset={8}>{group.items.map(([id,label])=><DropdownMenuItem key={id} onClick={()=>onSelect(id)} aria-current={active===id?'page':undefined} className="property-menu-item"><span>{label}</span>{active===id&&<Check size={16} aria-label="Sección actual"/>}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>)}</nav>;}
export function PropertySection({active,value,children}:{active:string;value:string;children:ReactNode}){return active===value?<section id={'section-'+value} aria-labelledby="current-section-heading" className="property-section">{children}</section>:null;}
