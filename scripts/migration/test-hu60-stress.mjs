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
const patch = (data, cookie = cookies[0], from = origin) =>
  fetch(origin + '/api/scenarios/stress', {
    method: 'POST',
    headers: {
      cookie: cookie ?? '',
      origin: from,
      'content-type': 'application/json',
    },
    body: JSON.stringify(data),
  });
try {
  sql("notify pgrst,'reload schema';");
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
    const c = createClient(cfg.API_URL, cfg.PUBLISHABLE_KEY ?? cfg.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    assert.ifError(
      (await c.auth.signInWithPassword({ email, password })).error,
    );
    clients.push(c);
  }
  const id = prefix + '-p',
    version = '2026-10-11T00:00:00+00:00',
    body = {
      propertyId: id,
      version,
      bookVersion: null,
      label: 'Stress',
      stressIndex: 0,
      requestId: randomUUID(),
    };
  if (process.argv.includes('--expect-disabled')) {
    assert.equal((await patch(body)).status, 503);
    pass('save disabled by default');
  } else {
    const { build } = await import('esbuild');
    const bundle = await build({
      stdin: {
        contents:
          "export {fresh} from './lib/model';export {emptyInvestment,calculateFlip,stressProperty} from './lib/investment';",
        resolveDir: process.cwd(),
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      write: false,
    });
    const { fresh, emptyInvestment, calculateFlip, stressProperty } =
      await import(
        'data:text/javascript;base64,' +
          Buffer.from(bundle.outputFiles[0].text).toString('base64')
      );
    const property = fresh();
    property.id = id;
    property.investment = emptyInvestment(property);
    Object.assign(property.investment, {
      purchase: 100000,
      arv: 180000,
      purchaseDate: '2026-01-01',
      saleDate: '2026-07-01',
      costsReviewed: true,
    });
    property.investment.loan.type = 'Efectivo';
    sql(
      `insert into public.properties values (${q(id)},${q(users[0])},${q(JSON.stringify(property))},${q(version)});`,
    );
    const transformed = stressProperty(property, 0),
      expected = calculateFlip(transformed, transformed.investment);
    const baselineId = prefix + '-base';
    sql(
      `insert into public.analysis_scenarios(id,property_id,user_id,label,payload,created_at) values (${q(baselineId)},${q(id)},${q(users[0])},'Base','{}',now());insert into public.analysis_baselines values(${q(id)},${q(users[0])},${q(baselineId)},now());`,
    );
    assert.equal((await patch({ ...body, stressIndex: 6 })).status, 400);
    pass('out of range stress denied');
    assert.equal((await patch({ ...body, stressIndex: 5 })).status, 400);
    pass('unconfigured stress denied');
    assert.equal((await patch(body, '')).status, 401);
    pass('anonymous denied');
    assert.equal(
      (await patch(body, cookies[0], 'https://untrusted.example')).status,
      403,
    );
    pass('origin checked');
    assert.equal(
      (await patch({ ...body, snapshot: { result: { profit: 999999 } } }))
        .status,
      400,
    );
    pass('client cannot inject result');
    assert.equal((await patch({ ...body, actor: users[1] })).status, 400);
    pass('client cannot inject actor');
    assert.equal((await patch(body, cookies[1])).status, 403);
    pass('foreign owner denied');
    assert.equal(
      (await patch({ ...body, version: '2020-01-01T00:00:00Z' })).status,
      409,
    );
    pass('stale view denied');
    let r = await patch(body);
    assert.equal(r.status, 201, await r.clone().text());
    const saved = await r.json();
    pass('new scenario committed');
    const stored = JSON.parse(
      sql(
        `select payload from public.analysis_scenarios where id=${q(saved.id)};`,
      ),
    );
    assert.equal(stored.result.profit, expected.profit);
    assert.equal(stored.property.id, id);
    assert.deepEqual(stored.sourceStress, property.investment.stress[0]);
    assert.equal(stored.result.arv, expected.arv);
    assert.equal(stored.result.saleDate, expected.saleDate);
    assert.equal(
      sql(
        `select scenario_id from public.analysis_baselines where property_id=${q(id)};`,
      ).trim(),
      baselineId,
    );
    assert.equal(
      JSON.parse(
        sql(`select payload from public.properties where id=${q(id)};`),
      ).investment.arv,
      property.investment.arv,
    );
    pass(
      'stress provenance, original property and approved baseline preserved',
    );
    assert.equal(stored.engine, expected.engine);
    pass('server computed expected figures');
    const detail = await (
      await fetch(
        origin +
          '/api/preview/scenarios?' +
          new URLSearchParams({ propertyId: id, id: saved.id }),
        { headers: { cookie: cookies[0] } },
      )
    ).json();
    assert.equal(
      detail.scenario.sourceStress.name,
      property.investment.stress[0].name,
    );
    assert.equal(
      detail.scenario.sourceStress.adjustments.arvChange,
      property.investment.stress[0].arvChange,
    );
    const options = await (
      await fetch(
        origin +
          '/api/preview/scenarios?' +
          new URLSearchParams({ propertyId: id }),
        { headers: { cookie: cookies[0] } },
      )
    ).json();
    assert.equal(options.stressOptions.length, 2);
    assert.equal(options.stressOptions[0].index, 0);
    pass('stress options and historical adjustments exposed to owner');
    sql(`update public.properties set updated_at=now() where id=${q(id)};`);
    r = await patch(body);
    assert.equal(r.status, 200, await r.clone().text());
    assert.equal((await r.json()).id, saved.id);
    pass('lost-response retry survives subsequent property edit');
    assert.equal((await patch({ ...body, label: 'Different' })).status, 409);
    pass('request identity cannot be repurposed');
    const clientArgs = {
      actor: users[0],
      property_id: id,
      expected_version: version,
      expected_book_version: null,
      label: 'Injected',
      request_id: randomUUID(),
      snapshot: stored,
      stress_index: 0,
    };
    assert(
      (await clients[0].rpc('stress_computed_scenario', clientArgs)).error,
    );
    pass('authenticated direct computed RPC denied');
    assert.equal(
      sql(
        `select count(*) from public.analysis_scenarios where property_id=${q(id)};`,
      ).trim(),
      '2',
    );
    assert.equal(
      sql(
        `select count(*) from public.audit_events where property_id=${q(id)};`,
      ).trim(),
      '1',
    );
    pass('single snapshot and audit');
    const currentVersion = '2026-10-11T02:00:00+00:00';
    sql(
      `update public.properties set updated_at=${q(currentVersion)} where id=${q(id)};`,
    );
    const simultaneous = {
      ...body,
      version: currentVersion,
      label: 'Simultaneous',
      requestId: randomUUID(),
    };
    const retries = await Promise.all([
      patch(simultaneous),
      patch(simultaneous),
    ]);
    assert.deepEqual(retries.map((r) => r.status).sort(), [200, 201]);
    const replies = await Promise.all(retries.map((r) => r.json()));
    assert.equal(replies[0].id, replies[1].id);
    pass('simultaneous save retry creates one scenario');
    sql(
      `insert into public.analysis_scenarios(id,property_id,user_id,label,payload,created_at) select ${q(prefix)}||'-fill-'||n,${q(id)},${q(users[0])},'Fill','{}',now() from generate_series(1,46)n;`,
    );
    const race = await Promise.all(
      ['Final A', 'Final B'].map((label) =>
        patch({
          ...body,
          version: currentVersion,
          label,
          requestId: randomUUID(),
        }),
      ),
    );
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      sql(
        `select count(*) from public.analysis_scenarios where property_id=${q(id)};`,
      ).trim(),
      '50',
    );
    pass('concurrent new saves respect limit of 50');
  }
  console.log(JSON.stringify({ checks, production_modified: false }));
} finally {
  for (const cookie of cookies)
    await fetch(origin + '/auth/logout', {
      method: 'POST',
      headers: { cookie, origin },
      redirect: 'manual',
    });
  for (const c of clients) await c.auth.signOut();
  for (const id of users) {
    sql(
      `begin;delete from public.audit_events where user_id=${q(id)};delete from public.analysis_baselines where user_id=${q(id)};delete from public.analysis_scenarios where user_id=${q(id)};delete from public.accounting_books where user_id=${q(id)};delete from public.opening_balances where user_id=${q(id)};delete from public.investment_projects where user_id=${q(id)};delete from public.property_baselines where user_id=${q(id)};delete from public.properties where user_id=${q(id)};commit;`,
    );
    assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  }
}
