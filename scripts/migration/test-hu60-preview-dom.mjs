/** Component interactions with a simulated API. Does not replace real HTTP/RLS or browser layout tests.
 * JSDOM_MODULE may point to an externally installed, pinned jsdom@26.1.0 module.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url),
  dir = await mkdtemp(join(tmpdir(), 'rehab-preview-dom-'));
const { JSDOM } = await import(process.env.JSDOM_MODULE ?? 'jsdom');
const dom = new JSDOM('<div id="root"></div>', {
  url: 'http://127.0.0.1:3000/ensayo',
});
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'Event',
  'MouseEvent',
])
  globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement, act } = await import('react'),
  { createRoot } = await import('react-dom/client');
let root,
  checks = 0;
const pass = (s) => {
  checks++;
  console.log('PASS ' + s);
};
const initial = () => ({
  properties: [
    { id: 'p1', name: 'Casa A', updatedAt: '2026-10-11T00:00:00.000001Z' },
    { id: 'p2', name: 'Casa B', updatedAt: '2026-10-11T00:00:00Z' },
  ],
  scenarios: [
    { id: 's1', label: 'Base original', created_at: '2026-10-11T00:00:00Z' },
  ],
  calls: [],
  receipts: new Map(),
  failWrite: false,
  failRead: false,
  conflict: false,
});
let state;
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const field = (label) => {
  const el = [...document.querySelectorAll('label')].find(
    (l) => l.firstChild.textContent.trim() === label,
  );
  assert(el, 'label ' + label);
  return el.querySelector('input,textarea,select');
};
const button = (text) => {
  const el = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === text,
  );
  assert(el, text);
  return el;
};
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
async function fill(label, value) {
  await act(async () => {
    const el = field(label);
    const proto =
      el.tagName === 'TEXTAREA'
        ? dom.window.HTMLTextAreaElement.prototype
        : el.tagName === 'SELECT'
          ? dom.window.HTMLSelectElement.prototype
          : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(
      new dom.window.Event(el.tagName === 'SELECT' ? 'change' : 'input', {
        bubbles: true,
      }),
    );
  });
}
async function click(label) {
  await act(async () => button(label).click());
  await settle();
}
try {
  await build({
    entryPoints: ['app/ensayo/workspace.tsx'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    outfile: join(dir, 'workspace.mjs'),
    plugins: [
      {
        name: 'component-test',
        setup(b) {
          b.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({
            path: require.resolve(args.path),
            external: true,
          }));
          b.onLoad({ filter: /\.css$/ }, () => ({
            contents: 'export default {}',
            loader: 'js',
          }));
        },
      },
    ],
  });
  const Workspace = (
    await import(pathToFileURL(join(dir, 'workspace.mjs')).href)
  ).default;
  async function mount(options = {}) {
    if (root) await act(async () => root.unmount());
    state = initial();
    Object.assign(state, options.state);
    globalThis.fetch = async (url, init) => {
      if (init?.method) {
        const body = JSON.parse(init.body);
        state.calls.push({ url, body });
        if (state.conflict)
          return response({ error: 'La propiedad cambió. Actualiza.' }, 409);
        if (!state.receipts.has(body.requestId)) {
          state.receipts.set(body.requestId, body);
          if (url.includes('/name'))
            state.properties[0] = {
              ...state.properties[0],
              name: body.name,
              updatedAt: '2026-10-11T01:00:00Z',
            };
          else state.scenarios.push({ id: body.requestId, label: body.label });
        }
        if (state.failWrite) {
          state.failWrite = false;
          throw Error('Respuesta perdida');
        }
        return response({ id: body.requestId });
      }
      if (state.failRead) throw Error('Lectura no disponible');
      if (url === '/api/properties')
        return response({ properties: state.properties });
      const id = new URL(url, dom.window.location.origin).searchParams.get(
        'propertyId',
      );
      return response({
        propertyId: id,
        version: '2026-10-11T00:00:00.000002Z',
        bookVersion: null,
        baseId: 's1',
        scenarios: id === 'p1' ? state.scenarios : [],
      });
    };
    root = createRoot(document.getElementById('root'));
    await act(async () =>
      root.render(
        createElement(Workspace, { writable: options.writable ?? true }),
      ),
    );
    await settle();
  }
  await mount();
  assert.equal(field('Nombre').value, 'Casa A');
  assert(document.body.textContent.includes('Base aprobada'));
  pass('property and approved scenario rendered');
  await fill('Nombre', 'Casa nueva');
  await fill('Motivo del cambio', 'Corregir nombre');
  await click('Guardar nombre');
  assert.equal(state.calls[0].body.version, '2026-10-11T00:00:00.000001Z');
  assert.equal(field('Nombre').value, 'Casa nueva');
  assert(document.body.textContent.includes('Nombre guardado.'));
  pass('rename sends displayed version and refreshes');
  await mount();
  await fill('Nombre de la copia', 'Copia uno');
  await click('Duplicar escenario');
  assert.equal(state.scenarios.length, 2);
  assert(document.querySelector('ul').textContent.includes('Copia uno'));
  assert.equal(state.calls[0].body.bookVersion, null);
  pass('duplicate sends version tokens and refreshes scenarios');
  await mount({ state: { failWrite: true } });
  await fill('Nombre de la copia', 'Reintento');
  await click('Duplicar escenario');
  assert(document.querySelector('[role=alert]'));
  assert.equal(field('Nombre de la copia').value, 'Reintento');
  await click('Duplicar escenario');
  assert.equal(state.scenarios.length, 2);
  assert.equal(state.calls[0].body.requestId, state.calls[1].body.requestId);
  pass('lost response retries the same command once');
  await mount({ state: { conflict: true } });
  await fill('Nombre', 'Sin guardar');
  await fill('Motivo del cambio', 'Prueba');
  await click('Guardar nombre');
  assert.equal(field('Nombre').value, 'Sin guardar');
  assert(document.querySelector('[role=alert]').textContent.includes('cambió'));
  await click('Recargar datos');
  assert.equal(field('Nombre').value, 'Casa A');
  pass('conflict preserves inputs and explicit reload resets them');
  await mount({ writable: false });
  assert(field('Nombre').matches(':disabled'));
  assert(field('Nombre de la copia').matches(':disabled'));
  pass('read-only mode disables both forms');
  await mount({ state: { properties: [] } });
  assert(document.body.textContent.includes('Aún no hay propiedades'));
  assert.equal(document.querySelectorAll('form').length, 0);
  pass('empty account has no mutation forms');
  await mount({ state: { scenarios: [] } });
  assert(field('Nombre de la copia').matches(':disabled'));
  pass('no source prevents duplication');
  await mount({
    state: {
      scenarios: Array.from({ length: 50 }, (_, i) => ({
        id: 's' + i,
        label: 'Escenario ' + i,
      })),
    },
  });
  assert(field('Nombre de la copia').matches(':disabled'));
  pass('50 scenarios disable duplication');
  await mount();
  await fill('Propiedad', 'p2');
  await settle();
  assert.equal(field('Nombre').value, 'Casa B');
  assert(field('Nombre de la copia').matches(':disabled'));
  pass('switching property clears source scenarios');
  await mount();
  await fill('Nombre', 'Guardado');
  await fill('Motivo del cambio', 'Prueba');
  const originalFetch = fetch;
  globalThis.fetch = async (url, init) => {
    const r = await originalFetch(url, init);
    if (init?.method) state.failRead = true;
    return r;
  };
  await click('Guardar nombre');
  assert(document.body.textContent.includes('Nombre guardado.'));
  assert(document.querySelector('[role=alert]'));
  assert(field('Nombre').matches(':disabled'));
  pass('successful write plus failed refresh does not invite another mutation');
  // Two uncertain requests separated by an edit must retain their own retry identities.
  await mount({ state: { failWrite: true } });
  await fill('Nombre de la copia', 'Primera');
  await click('Duplicar escenario');
  state.failWrite = true;
  await fill('Nombre de la copia', 'Segunda');
  await click('Duplicar escenario');
  await fill('Nombre de la copia', 'Primera');
  await click('Duplicar escenario');
  assert.equal(state.scenarios.length, 3);
  assert.equal(state.calls[0].body.requestId, state.calls[2].body.requestId);
  pass('edited then restored uncertain command keeps retry identity');
  console.log(
    JSON.stringify({ checks, transport: 'simulated', visual_tested: false }),
  );
} finally {
  if (root) await act(async () => root.unmount());
  dom.window.close();
  await rm(dir, { recursive: true, force: true });
}
