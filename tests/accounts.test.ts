import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import type { AddressInfo } from 'net';

// The accounts script (scripts/ghost-accounts.cts) run the way the functions of the plugin run it, piped to
// `node --input-type=commonjs-typescript - <verb>`, against a stand-in for the site's Admin API and for the
// mailbox of the container. Node.js runs the TypeScript file as it is.

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const SCRIPT = path.join(PKG, 'scripts', 'ghost-accounts.cts');

interface User { id: string; name: string; email: string; password: string; roles: { id: string; name: string }[] }
interface Invite { id: string; email: string; role_id: string; token: string }
interface Mail { ID: string; to: string; Text: string }

const ROLES = ['Administrator', 'Editor', 'Author', 'Contributor'].map((name, i) => ({ id: `role-${i + 1}`, name }));
const OWNER = { name: 'webmaster', email: 'webmaster@example.com', password: 'the-owner-password' };
const STAFF = [
  { name: 'Editor', email: 'editor@example.com', password: 'a-staff-password-1', role: 'Editor' },
  { name: 'Author', email: 'author@example.com', password: 'a-staff-password-2', role: 'Author' },
];

/** A site that is not set up yet, and its mailbox: what the Admin API and the mailbox answer to the script. */
async function site() {
  const state = { setUp: false, users: [] as User[], invites: [] as Invite[], mails: [] as Mail[], requests: [] as string[], acceptedWithSession: 0, next: 1 };
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const url = new URL(req.url || '/', 'http://site');
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      const answer = (status: number, json?: object, headers: Record<string, string> = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
        res.end(json ? JSON.stringify(json) : '');
      };
      state.requests.push(`${req.method} ${url.pathname}`);
      const signedIn = /ghost-admin-api-session=owner/.test(req.headers.cookie || '');
      const api = url.pathname.replace(/^\/ghost\/api\/admin/, '');
      if (url.pathname.startsWith('/api/v1/')) {
        // The mailbox.
        if (url.pathname === '/api/v1/search') {
          const to = (url.searchParams.get('query') || '').replace(/^to:/, '');
          return answer(200, { messages: state.mails.filter((m) => m.to === to).map((m) => ({ ID: m.ID })) });
        }
        if (req.method === 'DELETE' && url.pathname === '/api/v1/messages') {
          state.mails = state.mails.filter((m) => !(body.IDs as string[]).includes(m.ID));
          return answer(200);
        }
        const mail = state.mails.find((m) => url.pathname === `/api/v1/message/${m.ID}`);
        return mail ? answer(200, mail) : answer(404);
      }
      if (api === '/authentication/setup/' && req.method === 'GET') return answer(200, { setup: [{ status: state.setUp }] });
      if (api === '/authentication/setup/' && req.method === 'POST') {
        const owner = body.setup[0];
        state.setUp = true;
        state.users.push({ id: 'user-1', name: owner.name, email: owner.email, password: owner.password, roles: [{ id: 'role-0', name: 'Owner' }] });
        return answer(201, { users: [{ id: 'user-1' }] });
      }
      if (api === '/session/' && req.method === 'POST') {
        const owner = state.users[0];
        if (!owner || body.username !== owner.email || body.password !== owner.password) {
          return answer(401, { errors: [{ message: 'Your password is incorrect.', context: 'Your password is incorrect.' }] });
        }
        return answer(201, undefined, { 'Set-Cookie': 'ghost-admin-api-session=owner; Path=/ghost; HttpOnly' });
      }
      if (api === '/authentication/invitation/' && req.method === 'POST') {
        // The invited person accepts: the script must not send the owner's session with it.
        if (signedIn) state.acceptedWithSession++;
        const accepted = body.invitation[0];
        const invite = state.invites.find((i) => i.token === accepted.token && i.email === accepted.email);
        if (!invite) return answer(404, { errors: [{ message: 'Invite not found.' }] });
        const role = ROLES.find((r) => r.id === invite.role_id);
        state.invites = state.invites.filter((i) => i !== invite);
        state.users.push({ id: `user-${++state.next}`, name: accepted.name, email: accepted.email, password: accepted.password, roles: role ? [role] : [] });
        return answer(201, { invitation: [{ message: 'Invitation accepted.' }] });
      }
      if (!signedIn) return answer(403, { errors: [{ message: 'Authorization failed', context: 'Unable to determine the authenticated user.' }] });
      if (api === '/roles/') return answer(200, { roles: ROLES });
      if (api === '/users/' && req.method === 'GET') return answer(200, { users: state.users.map(({ password, ...user }) => user) });
      if (api === '/invites/' && req.method === 'GET') return answer(200, { invites: state.invites.map(({ token, ...invite }) => invite) });
      if (api === '/invites/' && req.method === 'POST') {
        const asked = body.invites[0];
        const invite = { id: `invite-${++state.next}`, email: asked.email, role_id: asked.role_id, token: `token/${state.next}=` };
        state.invites.push(invite);
        state.mails.push({ ID: `mail-${state.next}`, to: asked.email, Text: `Join the site: https://site1.ddev.site/ghost/signup/${encodeURIComponent(invite.token)}/ (this link expires)` });
        state.mails.push({ ID: `other-${state.next}`, to: 'someone@example.com', Text: 'Another message of the site.' });
        return answer(201, { invites: [{ id: invite.id }] });
      }
      const removed = /^\/(users|invites)\/([^/]+)\/$/.exec(api);
      if (removed && req.method === 'DELETE') {
        if (removed[1] === 'users') state.users = state.users.filter((u) => u.id !== removed[2]);
        else state.invites = state.invites.filter((i) => i.id !== removed[2]);
        return answer(204);
      }
      return answer(404, { errors: [{ message: `No ${req.method} ${api} here.` }] });
    });
  });
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { state, base, close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }) };
}

/** Pipe the script to node with a verb, as ghost_accounts does, and answer what it printed and how it ended. */
function accounts(base: string, verb: string, given: object): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=commonjs-typescript', '-', verb], {
      env: { ...process.env, GHOST_INTERNAL_URL: base, MAILPIT_INTERNAL_URL: base, GHOST_ACCOUNTS: Buffer.from(JSON.stringify(given)).toString('base64') },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
    fs.createReadStream(SCRIPT).pipe(child.stdin);
  });
}

const GIVEN = { url: 'https://site1.ddev.site/', title: 'dev site1', owner: OWNER, staff: STAFF };

test('the accounts script sets a site up once, with the owner it is given', async () => {
  const s = await site();
  try {
    assert.strictEqual((await accounts(s.base, 'installed', GIVEN)).status, 3, 'a site that is not set up answers 3');
    const first = await accounts(s.base, 'setup', GIVEN);
    assert.strictEqual(first.status, 0, first.stderr);
    assert.strictEqual(first.stdout, '   The site is set up; its owner is webmaster@example.com.\n');
    assert.strictEqual((await accounts(s.base, 'installed', GIVEN)).status, 0);
    const again = await accounts(s.base, 'setup', GIVEN);
    assert.strictEqual(again.stdout, '   The site is already set up.\n');
    assert.strictEqual(s.state.users.length, 1);
  } finally {
    await s.close();
  }
});

test('the accounts script adds the staff through their invitations, lists them and deletes them; each can run again', async () => {
  const s = await site();
  try {
    await accounts(s.base, 'setup', GIVEN);
    const added = await accounts(s.base, 'add', GIVEN);
    assert.strictEqual(added.status, 0, added.stderr);
    assert.strictEqual(added.stdout, '   editor@example.com added (Editor).\n   author@example.com added (Author).\n');
    assert.deepStrictEqual(s.state.users.map((u) => `${u.email} ${u.roles[0]?.name}`), ['webmaster@example.com Owner', 'editor@example.com Editor', 'author@example.com Author']);
    assert.strictEqual(s.state.users[1]?.password, 'a-staff-password-1');
    assert.strictEqual(s.state.acceptedWithSession, 0, 'an invitation is accepted without the session of the owner');
    assert.deepStrictEqual(s.state.mails.map((m) => m.to), ['someone@example.com', 'someone@example.com'], 'the used invitations are out of the mailbox, the other messages stay');

    const again = await accounts(s.base, 'add', GIVEN);
    assert.strictEqual(again.stdout, '   editor@example.com is already there.\n   author@example.com is already there.\n');

    const listed = await accounts(s.base, 'list', GIVEN);
    assert.strictEqual(listed.status, 0, listed.stderr);
    assert.deepStrictEqual(listed.stdout.split('\n').filter(Boolean).map((l) => l.trim().split(/\s+/)), [
      ['webmaster@example.com', 'Owner', 'webmaster'], ['editor@example.com', 'Editor', 'Editor'], ['author@example.com', 'Author', 'Author']]);

    const cancelled = await accounts(s.base, 'cancel', GIVEN);
    assert.strictEqual(cancelled.stdout, '   editor@example.com deleted.\n   author@example.com deleted.\n');
    assert.strictEqual(s.state.users.length, 1);
    const gone = await accounts(s.base, 'cancel', GIVEN);
    assert.strictEqual(gone.stdout, '   editor@example.com is not there.\n   author@example.com is not there.\n');

    for (const out of [added, again, listed, cancelled, gone]) assert.doesNotMatch(out.stdout + out.stderr, /password/i, 'no password is printed');
  } finally {
    await s.close();
  }
});

test('the accounts script says why it cannot sign in as the owner, and which role a site does not have', async () => {
  const s = await site();
  try {
    await accounts(s.base, 'setup', GIVEN);
    const wrong = await accounts(s.base, 'list', { ...GIVEN, owner: { ...OWNER, password: 'another-password' } });
    assert.strictEqual(wrong.status, 1);
    assert.match(wrong.stderr, /^ {3}Could not sign in as the owner \(webmaster@example\.com\): POST \/session\/ answered 401: Your password is incorrect\. Your password is incorrect\.$/m);
    assert.doesNotMatch(wrong.stderr, /another-password|the-owner-password/);
    const role = await accounts(s.base, 'add', { ...GIVEN, staff: [{ ...STAFF[0], role: 'Publisher' }] });
    assert.strictEqual(role.status, 1);
    assert.strictEqual(role.stderr.trim(), 'This site has no "Publisher" role; it has: Administrator, Editor, Author, Contributor.');
  } finally {
    await s.close();
  }
});
