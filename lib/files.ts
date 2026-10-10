import {env} from 'cloudflare:workers';
export function fileBucket(){if(!env.FILES)throw Error('El almacenamiento de documentos no está disponible.');return env.FILES;}
