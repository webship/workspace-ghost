import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-ghost.sh');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

/** A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled. */
function project(type: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-plugin-'));
  const dir = path.join(root, 'dev', 'site1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), `name: site1\ntype: ${type === 'ghost' ? 'generic' : type}\ndocroot: ""\n`);
  if (type === 'ghost') {
    // What the builder leaves: the file a Ghost project is recognised by, and the site's configuration.
    fs.writeFileSync(path.join(dir, '.ddev', 'config.ghost.yaml'), 'web_extra_daemons: []\n');
    fs.mkdirSync(path.join(dir, 'ghost'));
    fs.writeFileSync(path.join(dir, 'ghost', 'config.production.json'), '{\n  "url": "https://site1.ddev.site",\n  "server": {}\n}\n');
  }
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'site1', devDependencies: { 'webship-js': '^2.0.6' } }, null, 2));
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'ghost'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'testing', 'site.feature'), path.join(scripts, 'plugins', 'ghost', 'site.feature'));
  fs.copyFileSync(path.join(PKG, 'scripts', 'ghost-accounts.js'), path.join(scripts, 'plugins', 'ghost', 'ghost-accounts.js'));
  return { root, dir, scripts };
}

/** Run bash with the plugin's functions sourced and `ddev` replaced by a recorder. */
function bash(script: string, env: Record<string, string> = {}) {
  const r = spawnSync('bash', ['-c', `ddev() { echo "ddev $*" >> "\${DDEV_LOG:-/dev/null}" ; return 0 ; }\nsleep() { :; }\nsource ${FUNCTIONS}\n${script}`],
    { encoding: 'utf8', env: { ...process.env, ...env } });
  return r;
}

/** What a recorded `ddev exec "GHOST_ACCOUNTS=<base64> node - <verb>"` handed to the accounts script. */
function payloads(log: string) {
  return fs.readFileSync(log, 'utf8').split('\n')
    .map((l) => /^ddev exec GHOST_ACCOUNTS=(\S+) node - (\w+)$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ verb: m[2], given: JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')) }));
}

const ACCOUNT = { account_name: 'webmaster', account_mail: 'webmaster@example.com', account_pass: 'a "quoted" $pass \'word' };

test('the default accounts are one per staff role, with example addresses', () => {
  const r = bash('set_ghost_users ; for u in "${users[@]}" ; do n="user_${u}_name" ; m="user_${u}_mail" ; p="user_${u}_password" ; l="user_${u}_role" ; echo "${!n}|${!m}|${!p}|${!l}" ; done');
  assert.strictEqual(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map((l) => l.split('|'));
  assert.deepStrictEqual(rows.map((x) => x[0]), ['administrator', 'editor', 'author', 'contributor']);
  assert.deepStrictEqual(rows.map((x) => x[3]), ['Administrator', 'Editor', 'Author', 'Contributor'], 'the roles as the platform writes them');
  for (const [name, mail, password] of rows) {
    assert.strictEqual(mail, `${name}@example.com`);
    assert.ok(password.length >= 10, 'the platform refuses a password under 10 characters');
  }
  assert.ok(!rows.some((x) => /owner/i.test(x[3])), 'the owner is the workspace account, never a default account');
});

test('the accounts reach the container as one encoded value: the owner is the workspace account, nothing is written to a file', () => {
  const p = project('ghost');
  const log = path.join(p.root, 'ddev.log');
  const r = bash('set_ghost_users ; add_ghost_users', { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log, ...ACCOUNT });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const [call] = payloads(log);
  assert.strictEqual(call.verb, 'add');
  assert.strictEqual(call.given.url, 'https://site1.ddev.site', 'the address the site is configured with');
  assert.deepStrictEqual(call.given.owner, { name: 'webmaster', email: 'webmaster@example.com', password: ACCOUNT.account_pass }, 'a password with quotes and a dollar sign arrives whole');
  assert.deepStrictEqual(call.given.staff.map((x: any) => `${x.email}:${x.role}`),
    ['administrator@example.com:Administrator', 'editor@example.com:Editor', 'author@example.com:Author', 'contributor@example.com:Contributor']);
  assert.doesNotMatch(r.stdout, new RegExp(ACCOUNT.account_pass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the password of the workspace account is not printed');
  const left = spawnSync('grep', ['-rl', 'quoted', p.dir], { encoding: 'utf8' });
  assert.strictEqual(left.stdout, '', 'and is in no file of the project');
  // The same door for removing them.
  assert.strictEqual(bash('set_ghost_users ; cancel_ghost_users', { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log, ...ACCOUNT }).status, 0);
  assert.strictEqual(payloads(log)[1].verb, 'cancel');
});

test('the builder\'s files give the site the container\'s own services and nothing personal', () => {
  const p = project('drupal11');
  fs.mkdirSync(path.join(p.dir, 'ghost'));
  const r = bash(`ghost_write_ddev_config ${p.dir} && ghost_write_web_build ${p.dir} 24 && ghost_write_config ${p.dir} https://site1.ddev.site "dev site1"`);
  assert.strictEqual(r.status, 0, r.stderr);
  const config = JSON.parse(fs.readFileSync(path.join(p.dir, 'ghost', 'config.production.json'), 'utf8'));
  assert.strictEqual(config.url, 'https://site1.ddev.site');
  assert.deepStrictEqual(config.database.connection, { host: 'db', port: 3306, user: 'db', password: 'db', database: 'db' });
  assert.deepStrictEqual([config.mail.options.host, config.mail.options.port], ['127.0.0.1', 1025], 'the mail stays in the container');
  assert.match(config.mail.from, /<noreply@example\.com>$/);
  assert.strictEqual(config.privacy.useTinfoil, true, 'no update check and no call to an outside service');
  const ddev = fs.readFileSync(path.join(p.dir, '.ddev', 'config.ghost.yaml'), 'utf8');
  assert.match(ddev, /web_extra_exposed_ports:\n  - name: ghost\n    container_port: 2368\n    http_port: 80\n    https_port: 443/);
  assert.match(ddev, /web_extra_daemons:\n  - name: ghost\n    command: ".*exec node current\/index\.js'"/);
  assert.match(fs.readFileSync(path.join(p.dir, '.ddev', 'web-build', 'Dockerfile.ghost'), 'utf8'), /^RUN N_PREFIX=\/usr\/local n install 24 /m, 'Node.js is in the image before the daemon starts');
});

test('the testing hook adds the step pack, the users registry, the mailbox and a first feature to a Ghost project, once', () => {
  const p = project('ghost');
  const log = path.join(p.root, 'ddev.log');
  const run = () => bash(`cd ${p.dir} && testing_configure_ghost ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log, ...ACCOUNT });
  const r = run();
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/ghost-steps'], '^2.0.0');
  assert.strictEqual(pkg.devDependencies['webship-js'], '^2.0.6', 'what was there stays');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const lines = cucumber.split('\n');
  const core = lines.findIndex((l) => l.includes('node_modules/webship-js/tests/step-definitions'));
  assert.strictEqual(lines[core + 1], "      'node_modules/@webship-js/ghost-steps/tests/step-definitions/**/*.js',", 'the pack is listed right after webship-js');
  assert.match(cucumber, /administrator: \{ name: 'administrator', role: 'Administrator', email: process\.env\.SITE_ADMINISTRATOR_EMAIL \|\| 'administrator@example\.com', password: process\.env\.SITE_ADMINISTRATOR_PASSWORD \|\| '[^']+' \},/);
  assert.match(cucumber, /contributor: \{ name: 'contributor', role: 'Contributor', email: process\.env\.SITE_CONTRIBUTOR_EMAIL \|\| 'contributor@example\.com'/);
  assert.doesNotMatch(cucumber, /webmaster|quoted/, 'the workspace account is not in the registry');
  // Still a module node can load, with the registry where webship-js reads it.
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; console.log(JSON.stringify([c.require, Object.keys(c.worldParameters.users), c.worldParameters.mailUrl, c.worldParameters.javascript.mode]))`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  const [requires, handles, mailUrl, jsMode] = JSON.parse(loaded.stdout);
  assert.strictEqual(requires.length, 3);
  assert.deepStrictEqual(handles, ['administrator', 'editor', 'author', 'contributor']);
  assert.match(mailUrl, /:8026$/, 'the mailbox the membership steps read');
  assert.strictEqual(jsMode, 'off', 'the errors the admin logs for a refused request are not reported as failures of the page');
  assert.ok(fs.existsSync(path.join(p.dir, 'tests', 'features', 'site.feature')));
  assert.deepStrictEqual(payloads(log).map((c) => c.verb), ['installed', 'add'], 'a site that is set up gets the default accounts');
  // Again, after a person changed the feature: nothing is doubled, nothing is reset.
  fs.writeFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'Feature: mine\n');
  assert.strictEqual(run().status, 0);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), cucumber);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), 'Feature: mine\n');
});

test('the testing hook leaves a project of another platform alone', () => {
  const p = project('drupal11');
  const r = bash(`cd ${p.dir} && testing_configure_ghost ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), SCAFFOLD);
  assert.ok(!fs.existsSync(path.join(p.dir, 'tests')));
});

test('the CLI tool refuses a project that is not Ghost', () => {
  const p = project('drupal11');
  const r = bash('PROJECT_NAME=site1 ; RUN="doctor" ; trim_project_name() { :; } ; ghost_cli_tool', { WORKSPACE_ROOT: p.root, doc_name: 'dev' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /is not a Ghost project/);
});

test('the first feature names no platform in a step, and no password', () => {
  const feature = fs.readFileSync(path.join(PKG, 'testing', 'site.feature'), 'utf8');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  assert.ok(steps.length >= 10);
  for (const s of steps) assert.doesNotMatch(s, /ghost/i, s);
  assert.doesNotMatch(feature, /password "/);
  assert.doesNotMatch(feature, /invit|I register|sign up/i, 'a suite never creates an account');
  assert.doesNotMatch(feature, /"owner"/, 'the owner is the workspace account: no scenario signs in as it');
});

test('the --run example of the help and of the README is one that runs on a running site', () => {
  // `ghost doctor` fails its config check while Ghost is running ("Port '2368' is in use", exit 1):
  // Ghost itself holds the port. It is not the example to hand to somebody who has just built a site.
  const help = fs.readFileSync(path.join(PKG, 'scripts', 'args', 'arg-ghost-cli.sh'), 'utf8');
  const example = /Example: --run "([^"]+)"/.exec(help);
  assert.ok(example, 'the help of --run gives an example');
  assert.strictEqual(example![1], 'version');
  const readme = fs.readFileSync(path.join(PKG, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /--run "doctor"/);
  // Where doctor is still shown, the line says what it answers.
  const agent = fs.readFileSync(path.join(PKG, 'ai', 'agents', 'ghost-site-builder.md'), 'utf8');
  for (const line of agent.split('\n').filter((l) => /--run "doctor"/.test(l))) assert.match(line, /in use/, line);
});
