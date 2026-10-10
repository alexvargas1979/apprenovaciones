export const MAX_FILE_BYTES=10*1024*1024;
export const MAX_DOCUMENT_VERSIONS=1000;
export const documentCategories=['Term sheet','Presupuesto','Foto','Factura','Cierre','Contrato','Inspección','Comparable','Otro'];
export const documentLinks=['Expediente','Préstamo','Factura','Tarea','Comparable'];
export type DocumentVersion={id:string;groupId:string;propertyId:string;version:number;filename:string;mime:string;size:number;sha256:string;title:string;category:string;linkType:string;linkRef:string;note:string;createdAt:string};
const formats:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xlsm:'application/vnd.ms-excel.sheet.macroEnabled.12',csv:'text/csv'};
export const fileAccept='.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xlsm,.csv';
export function safeFilename(name:string){return name.split(/[\\/]/).at(-1)!.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,180)||'archivo';}
function zipEntries(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Contenedor Office incompleto.');
 const total=view.getUint16(end+10,true);let at=view.getUint32(end+16,true);if(total>5000)throw Error('El archivo Office contiene demasiadas entradas.');
 const entries=new Set<string>();for(let i=0;i<total;i++){
  if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw Error('Contenedor Office inválido.');
  const len=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true);
  if(at+46+len+extra+comment>bytes.length)throw Error('Contenedor Office incompleto.');
  entries.add(new TextDecoder().decode(bytes.subarray(at+46,at+46+len)));at+=46+len+extra+comment;
 }return entries;
}
export function validateFile(name:string,bytes:Uint8Array){
 if(!bytes.length||bytes.length>MAX_FILE_BYTES)throw Error('El archivo debe tener contenido y pesar como máximo 10 MB.');
 const filename=safeFilename(name),ext=filename.split('.').at(-1)!.toLowerCase(),mime=formats[ext];if(!mime)throw Error('Formato no admitido. Usa PDF, JPG, PNG, WEBP, DOCX, XLSX, XLSM o CSV.');
 const prefix=new TextDecoder().decode(bytes.subarray(0,12));let valid=false;
 if(ext==='pdf')valid=prefix.startsWith('%PDF-');
 if(ext==='jpg'||ext==='jpeg')valid=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(ext==='png')valid=[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 if(ext==='webp')valid=prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP';
 if(['docx','xlsx','xlsm'].includes(ext)){const entries=zipEntries(bytes);valid=bytes[0]===80&&bytes[1]===75&&entries.has('[Content_Types].xml')&&entries.has(ext==='docx'?'word/document.xml':'xl/workbook.xml');if(ext!=='xlsm'&&[...entries].some(x=>/vbaproject\.bin$/i.test(x)))throw Error('El formato declarado no corresponde al archivo con macros.');}
 if(ext==='csv'){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);valid=!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text);}catch{valid=false;}}
 if(!valid)throw Error('El contenido no coincide con el formato declarado.');return {filename,mime};
}
// Limit the actual streamed request even when Content-Length is absent or incorrect.
export async function uploadForm(req:Request){
 const limit=MAX_FILE_BYTES+64*1024;if(Number(req.headers.get('content-length'))>limit)throw Error('La carga supera el límite de 10 MB.');
 const reader=req.body?.getReader();if(!reader)throw Error('Carga vacía.');let length=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw Error('La carga supera el límite de 10 MB.');}chunks.push(value);}
 const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 return new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')??''}}).formData();
}
