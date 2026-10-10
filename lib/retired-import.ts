// Read compatibility for older saved payloads. Values already entered remain unchanged.
export function withoutRetiredImport<T>(value:T):T {
 if(Array.isArray(value))return value.map(withoutRetiredImport) as T;
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/^attom/i.test(key)).map(([key,v])=>[key,key==='source'&&v==='ATTOM'?'Importación anterior':withoutRetiredImport(v)])) as T;
 return value;
}
