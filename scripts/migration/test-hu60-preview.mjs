import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const cli = process.env.SUPABASE_CLI ?? 'supabase',
  origin = 'http://127.0.0.1:3000';
const cfg = JSON.parse(
  execFileSync(cli, ['status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
assert.equal(cfg.API_URL, 'http://127.0.0.1:54321');
const admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  users = [],
  cookies = [],
  clients = [],
  prefix = 'hu60-scenario-' + randomUUID();
const q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const sql = (s) =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_apprenovaciones-local',
      'psql',
      '-X',
      '-q',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { input: s, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
let checks = 0;
const pass = (s) => {
  checks++;
  console.log('PASS ' + s);
};
const httpOnly = process.argv.includes('--http-only');
const browser = httpOnly
  ? null
  : await (
      await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
    ).chromium.launch({
      executablePath:
        process.env.CHROME_PATH ??
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
    });
try {
  for (let i = 0; i < 2; i++) {
    const email = prefix + i + '@example.invalid',
      password = randomBytes(24).toString('hex');
    const u = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(u.error);
    users.push(u.data.user.id);
    const login = await fetch(origin + '/auth/login', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password }),
      redirect: 'manual',
    });
    assert.equal(login.status, 303);
    cookies.push(
      login.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    );
  }
  if (process.argv.includes('--expect-disabled')) {
    const r = await fetch(origin + '/api/preview/scenarios?propertyId=none', {
      headers: { cookie: cookies[0] },
    });
    assert.equal(r.status, 503);
    pass('scenario preview disabled');
    assert.equal(
      (
        await fetch(origin + '/api/preview/scenarios?propertyId=none&id=none', {
          headers: { cookie: cookies[0] },
        })
      ).status,
      503,
    );
    pass('scenario detail disabled');
    const html = await (
      await fetch(origin + '/ensayo', { headers: { cookie: cookies[0] } })
    ).text();
    assert(html.includes('Prueba local no habilitada'));
    pass('preview page disabled');
    const account = await (
      await fetch(origin + '/cuenta', { headers: { cookie: cookies[0] } })
    ).text();
    assert(!account.includes('Abrir cartera de prueba local'));
    pass('account hides disabled preview');
  } else {
    const id = prefix + '-p',
      source = prefix + '-source',
      version = '2026-10-11T00:00:00Z';
    sql(`insert into public.properties values (${q(id)},${q(users[0])},'{"name":"Casa de prueba Atlanta","address":"Atlanta, Georgia","values":{},"lines":{}}',${q(version)});
 insert into public.analysis_scenarios(id,property_id,user_id,label,payload,created_at) values (${q(source)},${q(id)},${q(users[0])},'Plan inicial','{"engine":"historical","result":{"profit":123.45}}',now());
 insert into public.analysis_baselines values (${q(id)},${q(users[0])},${q(source)},now());`);
    const endpoint =
      origin + '/api/preview/scenarios?propertyId=' + encodeURIComponent(id);
    assert.equal((await fetch(endpoint)).status, 401);
    pass('anonymous scenario list denied');
    assert.equal(
      (await fetch(endpoint, { headers: { cookie: cookies[1] } })).status,
      404,
    );
    pass('foreign property denied');
    const result = await fetch(endpoint, { headers: { cookie: cookies[0] } });
    assert.equal(result.status, 200);
    const list = await result.json();
    assert.equal(list.baseId, source);
    assert.equal(list.scenarios.length, 1);
    assert.equal(list.bookVersion, null);
    assert(!('payload' in list.scenarios[0]));
    pass('owner sees bounded metadata and version tokens');
    const detailUrl = endpoint + '&id=' + encodeURIComponent(source);
    assert.equal((await fetch(detailUrl)).status, 401);
    pass('anonymous detail denied');
    assert.equal(
      (await fetch(detailUrl, { headers: { cookie: cookies[1] } })).status,
      404,
    );
    pass('foreign owner detail denied');
    const detailResponse = await fetch(detailUrl, {
      headers: { cookie: cookies[0] },
    });
    assert.equal(detailResponse.status, 200);
    assert(detailResponse.headers.get('cache-control').includes('no-store'));
    const detail = (await detailResponse.json()).scenario;
    assert.equal(detail.id, source);
    assert.equal(detail.metrics.profit, 123.45);
    assert.equal(detail.metrics.purchase, null);
    assert.equal(detail.checksRecorded, false);
    assert(!('payload' in detail));
    pass('historical metrics returned without invented zeroes or raw snapshot');
    assert.equal(
      (
        await fetch(endpoint + '&id=missing', {
          headers: { cookie: cookies[0] },
        })
      ).status,
      404,
    );
    pass('missing scenario denied');
    assert.equal(
      (await fetch(endpoint + '&id=', { headers: { cookie: cookies[0] } }))
        .status,
      400,
    );
    pass('empty scenario id rejected');
    const other = prefix + '-other';
    sql(
      `insert into public.properties values (${q(other)},${q(users[0])},'{"name":"Other","values":{},"lines":{}}',${q(version)});`,
    );
    assert.equal(
      (
        await fetch(
          origin +
            '/api/preview/scenarios?' +
            new URLSearchParams({ propertyId: other, id: source }),
          { headers: { cookie: cookies[0] } },
        )
      ).status,
      404,
    );
    pass('same owner cannot mix property and scenario');
    sql(`delete from public.properties where id=${q(other)};`);
    assert.equal(
      sql(
        `select payload->'result'->>'profit' from public.analysis_scenarios where id=${q(source)};`,
      ).trim(),
      '123.45',
    );
    pass('reading does not recalculate stored result');

    const account = await fetch(origin + '/cuenta', {
      headers: { cookie: cookies[0] },
    });
    assert.equal(account.status, 200);
    assert((await account.text()).includes('Abrir cartera de prueba local'));
    pass('account exposes local preview link');
    const view = await fetch(origin + '/ensayo', {
      headers: { cookie: cookies[0] },
    });
    assert.equal(view.status, 200);
    const html = await view.text();
    assert(html.includes('Mi cartera') && html.includes('Prueba local'));
    pass('authenticated preview page renders');
    assert.equal(
      (await fetch(origin + '/ensayo', { redirect: 'manual' })).status,
      307,
    );
    pass('anonymous preview redirects to login');
    if (browser) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      await context.addCookies(
        cookies[0].split('; ').map((c) => ({
          name: c.slice(0, c.indexOf('=')),
          value: c.slice(c.indexOf('=') + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        })),
      );
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin + '/cuenta');
      await page
        .getByRole('link', { name: 'Abrir cartera de prueba local' })
        .click();
      await page
        .getByRole('heading', { name: 'Casa de prueba Atlanta', exact: true })
        .waitFor();
      await page
        .getByLabel('Nombre', { exact: true })
        .fill('Casa renovada Atlanta');
      await page.getByLabel('Motivo del cambio').fill('Prueba de interfaz');
      await page.getByRole('button', { name: 'Guardar nombre' }).click();
      await page
        .getByRole('heading', { name: 'Casa renovada Atlanta', exact: true })
        .waitFor();
      pass('account link and rename form persist');
      await page.getByLabel('Nombre de la copia').fill('Venta alternativa');
      await page.getByRole('button', { name: 'Duplicar escenario' }).click();
      await page
        .locator('li')
        .filter({ hasText: 'Venta alternativa' })
        .waitFor();
      pass('duplicate form refreshes list');
      const after = await (
        await fetch(endpoint, { headers: { cookie: cookies[0] } })
      ).json();
      assert.equal(after.scenarios.length, 2);
      assert.equal(after.baseId, source);
      pass('approved baseline preserved after UI write');
      // Simulate a lost response after the server committed. Retrying must not create a second copy.
      let first = true;
      await page.route('**/api/scenarios/duplicate', async (route) => {
        if (first) {
          first = false;
          await route.fetch();
          await route.abort('failed');
        } else await route.continue();
      });
      await page.getByLabel('Nombre de la copia').fill('Copia con reintento');
      await page.getByRole('button', { name: 'Duplicar escenario' }).click();
      await page.getByRole('alert').waitFor();
      await page.getByRole('button', { name: 'Duplicar escenario' }).click();
      await page
        .locator('li')
        .filter({ hasText: 'Copia con reintento' })
        .waitFor();
      const retried = await (
        await fetch(endpoint, { headers: { cookie: cookies[0] } })
      ).json();
      assert.equal(
        retried.scenarios.filter((s) => s.label === 'Copia con reintento')
          .length,
        1,
      );
      pass('lost response retry creates one copy');
      // Another writer invalidates the version currently displayed.
      sql(`update public.properties set updated_at=now() where id=${q(id)};`);
      await page.getByLabel('Nombre', { exact: true }).fill('Conflicting name');
      await page.getByLabel('Motivo del cambio').fill('Conflict test');
      await page.getByRole('button', { name: 'Guardar nombre' }).click();
      await page.getByRole('alert').filter({ hasText: 'cambió' }).waitFor();
      assert.equal(
        await page.getByLabel('Nombre', { exact: true }).inputValue(),
        'Conflicting name',
      );
      pass('conflict preserves unsaved input');
      await page.getByRole('button', { name: 'Recargar datos' }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('input')?.value === 'Casa renovada Atlanta',
      );
      if (process.env.SCREENSHOT_DIR)
        await page.screenshot({
          path: process.env.SCREENSHOT_DIR + '/hu60-desktop.png',
          fullPage: true,
        });
      await page.setViewportSize({ width: 390, height: 844 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (process.env.SCREENSHOT_DIR)
        await page.screenshot({
          path: process.env.SCREENSHOT_DIR + '/hu60-mobile.png',
          fullPage: true,
        });
      assert.deepEqual(errors, []);
      pass('mobile layout and browser runtime');
      await context.clearCookies();
      await context.addCookies(
        cookies[1].split('; ').map((c) => ({
          name: c.slice(0, c.indexOf('=')),
          value: c.slice(c.indexOf('=') + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        })),
      );
      await page.goto(origin + '/ensayo');
      await page
        .getByRole('heading', { name: 'Aún no hay propiedades' })
        .waitFor();
      pass('empty account state');
    }
  }
  console.log(
    JSON.stringify({
      checks,
      browser_tested: !httpOnly,
      production_modified: false,
    }),
  );
} finally {
  await browser?.close();
  for (const cookie of cookies)
    await fetch(origin + '/auth/logout', {
      method: 'POST',
      headers: { cookie, origin },
      redirect: 'manual',
    });
  for (const id of users) {
    sql(
      `begin;delete from public.audit_events where user_id=${q(id)};delete from public.analysis_baselines where user_id=${q(id)};delete from public.analysis_scenarios where user_id=${q(id)};delete from public.accounting_books where user_id=${q(id)};delete from public.opening_balances where user_id=${q(id)};delete from public.investment_projects where user_id=${q(id)};delete from public.property_baselines where user_id=${q(id)};delete from public.properties where user_id=${q(id)};commit;`,
    );
    assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  }
}
