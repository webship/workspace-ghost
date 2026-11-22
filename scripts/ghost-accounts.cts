'use strict';

// The accounts of a Ghost site, through its Admin API: complete the setup with the owner, add the
// staff accounts, delete them, list who is there. Ghost has no command line for accounts, so this
// is the one door.
//
// Runs with Node.js inside the project's web container, against Ghost's own port, and reads the
// staff invitations from the Mailpit of the same container: nothing is e-mailed outside. The
// functions of the plugin (fun-ghost.sh) pipe it to `node --input-type=commonjs-typescript -` and
// hand it what it needs in GHOST_ACCOUNTS, base64 of a JSON object:
//
//   { url, title, owner: { name, email, password }, staff: [{ name, email, password, role }] }
//
// Verbs: installed | setup | add | cancel | list. Every one can run again: what is already as
// asked is left alone. No password is ever printed.
//
// TypeScript, run by Node.js as it is (type stripping, from Node.js 22.18): a CommonJS module (.cts)
// with erasable syntax only, so there is nothing to build. `npm run lint` of the plugin type-checks it.

/** An account as the functions of the plugin hand it over. */
interface Person {
  name?: string;
  email?: string;
  password?: string;
}

interface StaffPerson extends Person {
  role?: string;
}

/** GHOST_ACCOUNTS, decoded. */
interface Given {
  url?: string;
  title?: string;
  owner?: Person;
  staff?: StaffPerson[];
}

/** What the script reads of the Admin API's answers. */
interface GhostRole {
  id: string;
  name: string;
}

interface GhostUser {
  id: string;
  name: string;
  email: string;
  roles?: GhostRole[];
}

interface GhostInvite {
  id: string;
  email: string;
}

interface GhostErrors {
  errors?: { message: string; context?: string | null }[];
}

interface SetupStatus {
  setup: { status: boolean }[];
}

/** What the script reads of the mailbox's answers. */
interface MailSearch {
  messages?: { ID: string }[];
}

interface MailMessage {
  Text?: string;
  HTML?: string;
}

interface Invitation {
  id: string;
  body: string;
}

type Method = 'GET' | 'POST' | 'DELETE';
type Verb = () => Promise<void>;

/** The message of anything thrown. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const GHOST = process.env.GHOST_INTERNAL_URL || 'http://127.0.0.1:2368';
const MAILPIT = process.env.MAILPIT_INTERNAL_URL || 'http://127.0.0.1:8025';
const API = GHOST + '/ghost/api/admin';

function input(): Given {
  const raw = process.env.GHOST_ACCOUNTS || '';
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as Given;
  } catch {
    throw new Error('GHOST_ACCOUNTS is not base64 of a JSON object.');
  }
}

const given: Given = input();
const SITE_URL = String(given.url || '').replace(/\/+$/, '');
let cookie = '';

async function call<Answer = unknown>(method: Method, endpoint: string, body?: object): Promise<Answer> {
  // Ghost sits behind the router of the container tool: say the request was https, and send the
  // Origin its session check compares with the address of the site.
  const headers: Record<string, string> = { 'X-Forwarded-Proto': 'https', Origin: SITE_URL };
  if (cookie) headers.Cookie = cookie;
  let payload: string | undefined;
  if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(API + endpoint, { method, headers, body: payload, redirect: 'manual' });
  const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  for (const line of setCookie) {
    if (/^ghost-admin-api-session=/.test(line)) cookie = line.split(';')[0] ?? '';
  }
  const text = await response.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!response.ok) {
    const first = ((json ?? {}) as GhostErrors).errors?.[0];
    const said = first ? first.message + (first.context ? ' ' + first.context : '') : text.slice(0, 300);
    throw Object.assign(new Error(`${method} ${endpoint} answered ${response.status}: ${said}`), { status: response.status });
  }
  return json as Answer;
}

async function isSetUp(): Promise<boolean> {
  const status = await call<SetupStatus>('GET', '/authentication/setup/');
  return !!status.setup[0]?.status;
}

async function signInAsOwner(): Promise<void> {
  const owner = given.owner || {};
  cookie = '';
  try {
    await call('POST', '/session/', { username: owner.email, password: owner.password });
  } catch (error) {
    throw new Error(`Could not sign in as the owner (${owner.email}): ${messageOf(error)}\n`
      + 'The owner of the site is the workspace account (account: in core/config/settings.yml); if its address or password was changed on the site, the accounts cannot be managed from here.');
  }
}

async function setup(): Promise<void> {
  if (await isSetUp()) {
    console.log('   The site is already set up.');
    return;
  }
  const owner = given.owner || {};
  await call('POST', '/authentication/setup/', {
    setup: [{ name: owner.name, email: owner.email, password: owner.password, blogTitle: given.title || 'Site' }],
  });
  console.log(`   The site is set up; its owner is ${owner.email}.`);
}

async function invitationFor(email: string): Promise<Invitation> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const found = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`)).json() as MailSearch;
    const id = found.messages?.[0]?.ID;
    if (id) {
      const mail = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json() as MailMessage;
      return { id, body: mail.Text || mail.HTML || '' };
    }
    await new Promise<void>((resolve) => { setTimeout(resolve, 1000); });
  }
  throw new Error(`No invitation for ${email} reached the mailbox of the container (${MAILPIT}). Is the mail of the site still sent to it (config.production.json, "mail")?`);
}

async function add(): Promise<void> {
  await signInAsOwner();
  const roles = (await call<{ roles: GhostRole[] }>('GET', '/roles/?limit=all')).roles;
  const users = (await call<{ users: GhostUser[] }>('GET', '/users/?limit=all')).users;
  for (const person of given.staff || []) {
    if (!person.email) continue;
    if (users.find((user) => user.email === person.email)) {
      console.log(`   ${person.email} is already there.`);
      continue;
    }
    const role = roles.find((candidate) => candidate.name === person.role);
    if (!role) throw new Error(`This site has no "${person.role}" role; it has: ${roles.map((r) => r.name).join(', ')}.`);
    const invites = (await call<{ invites: GhostInvite[] }>('GET', '/invites/?limit=all')).invites;
    if (!invites.find((invite) => invite.email === person.email)) {
      await call('POST', '/invites/', { invites: [{ email: person.email, role_id: role.id }] });
    }
    const mail = await invitationFor(person.email);
    const match = /\/ghost\/(?:#\/)?signup\/([^/\s"'<>]+)/.exec(mail.body);
    const token = match?.[1];
    if (!token) throw new Error(`The invitation for ${person.email} has no sign up link.`);
    // The invitation is accepted by the invited person: without the session of the owner.
    const session = cookie;
    cookie = '';
    await call('POST', '/authentication/invitation/', {
      invitation: [{ token: decodeURIComponent(token), email: person.email, name: person.name, password: person.password }],
    });
    cookie = session;
    // The invitation is used: take it out of the mailbox, and leave every other message there.
    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ IDs: [mail.id] }) });
    console.log(`   ${person.email} added (${person.role}).`);
  }
}

async function cancel(): Promise<void> {
  await signInAsOwner();
  const users = (await call<{ users: GhostUser[] }>('GET', '/users/?limit=all')).users;
  const invites = (await call<{ invites: GhostInvite[] }>('GET', '/invites/?limit=all')).invites;
  for (const person of given.staff || []) {
    const invite = invites.find((candidate) => candidate.email === person.email);
    if (invite) await call('DELETE', `/invites/${invite.id}/`);
    const user = users.find((candidate) => candidate.email === person.email);
    if (!user) {
      console.log(`   ${person.email} is not there.`);
      continue;
    }
    await call('DELETE', `/users/${user.id}/`);
    console.log(`   ${person.email} deleted.`);
  }
}

async function list(): Promise<void> {
  await signInAsOwner();
  const users = (await call<{ users: GhostUser[] }>('GET', '/users/?limit=all&include=roles')).users;
  for (const user of users) {
    console.log(`   ${user.email.padEnd(32)} ${(user.roles || []).map((role) => role.name).join(', ').padEnd(14)} ${user.name}`);
  }
}

const verbs: Record<string, Verb> = {
  installed: async () => { if (!(await isSetUp())) process.exit(3); },
  setup,
  add,
  cancel,
  list,
};

const verb: string = process.argv[2] ?? '';
const run: Verb | undefined = Object.hasOwn(verbs, verb) ? verbs[verb] : undefined;
if (!run) {
  console.error('ghost-accounts.cts <installed|setup|add|cancel|list>');
  process.exit(2);
}
run().catch((error: unknown) => {
  console.error('   ' + messageOf(error));
  process.exit(1);
});
