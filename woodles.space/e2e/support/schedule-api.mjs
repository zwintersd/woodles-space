import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { scheduleStore } from './schedule-store.mjs';

// This harness exists only in the local integration server. Transpile the
// production Edge handler, injecting the fixture at its database boundary.
export function scheduleApi(root) {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const store = scheduleStore();
  const lib = { db: () => store.sql, json: (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } }) };
  const modules = { './_lib': lib };
  function load(name) {
    if (modules[name]) return modules[name];
    const source = readFileSync(path.join(root, 'api', name.slice(2) + '.ts'), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    modules[name] = module.exports; return module.exports;
  }
  process.env.DATABASE_URL = 'postgres://schedule-test-fixture/db';
  process.env.SCHEDULE_PUBLISHER_PASS_HASH = createHash('sha256').update('fixture-publisher-passphrase').digest('hex');
  return load('./schedules').default;
}
