# @webship.co/workspace-ghost

Ghost for the [Webship Workspace](https://github.com/webship/workspace) dashboard: a builder that
makes a real, self-hosted Ghost site in a container, a Ghost-CLI tool for the sites it built, the
default staff accounts, the [Ghost step pack](https://github.com/webship/ghost-steps) wired into
the workspace's testing setup, and its AI items — two agents, a skill, a
command and a prompt — each listed in the workspace folder of its kind.

The workspace is container-based (DDEV by default): a Ghost project is a row like any other, so the
row menus the core draws (start, stop, launch, backup, clone, remove, tests) work on it unchanged.

It is the open-source Ghost, self-hosted: no hosted service, no payment provider and no vendor
account is connected, and the mail of the site never leaves the container.

The plugin is made from the reference platform plugin,
[`@webship.co/workspace-wordpress`](https://github.com/webship/workspace-wordpress); what differs is
what Ghost needs, see [What is different from a PHP platform](#what-is-different-from-a-php-platform).

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require github:webship/workspace-ghost   # npm install into the dashboard
bash core/scripts/plugins.sh --activate ghost                            # plugins.ghost in settings.yml
bash core/scripts/plugins.sh --install ghost                             # commands, functions, args, AI items
bash core/scripts/plugins.sh --configure ghost                           # nothing to configure: it has no settings file
```

The same four steps are buttons on the dashboard's **Settings → Plugins** page. `--install` is
idempotent. `--uninstall` removes what it placed; an AI item you edited stays.

Everything the plugin carries lands in the folder it belongs to, when that folder is an active
workspace folder:

| What | Lands in |
| --- | --- |
| `cmd-ghost-project.sh`, `cmd-tools-ghost-cli.sh` | every active sites folder: `dev/`, `test/`, `sandboxes/`, `demos/` |
| The agents `ghost-site-builder`, `ghost-tester` | `ai-agents/` |
| The skill `ghost-scenarios` | `ai-skills/` |
| The command `/ghost-test` | `ai-commands/` |
| The prompt `ghost-build-and-test` | `ai-prompts/` |

There they are listed like any other item of the folder, and installed into Claude Code from there.

The agents, the builder's flags in the Build form and the step pack in the testing setup need a
Webship Workspace after 1.0.6.

## What it needs

A workspace starts empty, so the manifest says what else this plugin needs (`needs`):

- one sites folder, for the builder and the tool: `dev`, `test`, `sandboxes`, `demos` (`dev` is the one added when none is there). The folder also carries `cmd-tools-testing.sh` and the Users tools this plugin's hooks answer to.
- `ai-agents`, `ai-skills`, `ai-commands` and `ai-prompts`: the AI folders its agents, its skill, its command and its prompt are placed in.

`--require` says so, `--activate` and `--install` stop until the workspace has them, and `--with-needs` adds what is missing first:

```bash
bash core/scripts/plugins.sh --activate ghost --with-needs   # dev and the four AI folders are required, activated and installed first
bash core/scripts/plugins.sh --install ghost
```

Everything the builder runs for a site runs in the site's own container, through the container tool the workspace already needs; the plugin asks for no command of its own on the machine.

A workspace that knows none of this (Webship Workspace 1.0.8 and older) ignores the keys: add a sites folder and the AI folders yourself, then `--install ghost` again. A kind whose folder is not there is skipped, and the install says so.

## What the package holds

| Path | What it is |
| --- | --- |
| `commands/cmd-ghost-project.sh` | The builder, in the Build list as **Ghost (latest)**, installed into every sites folder |
| `commands/cmd-tools-ghost-cli.sh` | Ghost-CLI for one project: what the site is, a command, an update, a restart, the default accounts |
| `scripts/functions/fun-ghost.sh` | The bash functions behind both, sourced by bootstrap once installed; the names the core's tools look for (`set_ghost_users`, `add_ghost_users`, `cancel_ghost_users`, `testing_configure_ghost`) |
| `scripts/args/arg-ghost.sh`, `arg-ghost-cli.sh` | Their argparse; the Build form draws the builder's flags from the first |
| `scripts/ghost-accounts.js` | The setup and the staff accounts through the Admin API, run with Node.js in the project's container |
| `testing/site.feature` | The first feature a Ghost project gets when testing is set up |
| `ai/agents/ghost-site-builder.md` | The agent that builds and maintains Ghost sites with these commands |
| `ai/agents/ghost-tester.md` | The agent that writes and runs scenarios with the Ghost step pack |
| `ai/skills/ghost-scenarios/` | The skill: the step pack's phrases by area, the traps found on a real site, three example features |
| `ai/commands/ghost-test.md` | The slash command `/ghost-test <site>`: set up, match every step, run, report |
| `ai/prompts/ghost-build-and-test.md` | A prompt: the whole launch command for a new session |
| `src/index.ts` | `register(api)`: what the assistant is told about Ghost here |
| `features/ghost.feature` | Scenarios for the dashboard's own browser suite |
| `docs/plugin-items-pattern.md` | How a plugin carries its own commands and AI items, and how to prove it |

The `workspacePlugin` block in `package.json` is the manifest the installer reads.

## What is different from a PHP platform

Ghost is a Node.js application and DDEV has no project type for it. The plugin keeps the shape of
the reference and changes only this:

| | WordPress (the reference) | Ghost |
| --- | --- | --- |
| Project | `--project-type=wordpress`, nginx and PHP | `--project-type=generic --webserver-type=generic`: no web server; the router sends the project's address to Ghost's port, and the web container runs Ghost as a daemon (`.ddev/config.ghost.yaml`) |
| Recognised by | The DDEV project type | The file `.ddev/config.ghost.yaml` |
| Node.js | The workspace's (24), for the front-end tools | The workspace's (24), and baked into the web image (`.ddev/web-build/Dockerfile.ghost`) so Ghost has it before the daemons start |
| Database | The container tool's default, settings written by the tool | MySQL 8 from the container tool; `config.production.json` carries the container's own `db` / `db` / `db` |
| Getting the code | `wp core download` | Ghost-CLI (`ghost install`), with `npx` in the container |
| Install | `wp core install` | The setup through the Admin API, with the workspace account as the owner |
| Accounts | WP-CLI | The Admin API: an invitation per account, accepted from the mailbox of the container |
| Users menu of the row | Reads the project type | Does not apply (no project type): `cmd-tools-ghost-cli.sh --add-users`, or `cmd-tools-add-users.sh <name> ghost` |

## The commands

Run them from a sites folder. `--help` is safe on both.

### Build a site

```bash
cd ~/workspace/dev
bash cmd-ghost-project.sh mysite --install --add-users
```

| Flag | What it does |
| --- | --- |
| `--version <x>` | The release to install: `latest` (the default), or a number such as `6.77.0` |
| `--install` | Set the site up, with the workspace account as its owner |
| `--add-users` | With `--install`: add the default staff accounts, one per role |
| `--launch` | Open the site when it is ready |

The site answers at `https://mysite.ddev.site`, the admin at `/ghost`. The code is in the project's
`ghost/` folder. The mail of the site goes to the mailbox of the container (`ddev mailpit`); the
update check and the other calls to outside services are switched off. A project of the same name
is deleted first.

Ghost asks for a password of 10 characters or more: if the workspace account's is shorter, the
site is built and the builder says that the setup waits at `/ghost`.

### Work on a site

```bash
bash cmd-tools-ghost-cli.sh mysite                         # version, address, staff accounts
bash cmd-tools-ghost-cli.sh mysite --run "version"         # any Ghost-CLI command
bash cmd-tools-ghost-cli.sh mysite --update                # the latest release, then Ghost is started again
bash cmd-tools-ghost-cli.sh mysite --restart               # start Ghost again and wait for it
bash cmd-tools-ghost-cli.sh mysite --add-users             # the default staff accounts
bash cmd-tools-ghost-cli.sh mysite --cancel-users          # delete them, and what they wrote
```

The process belongs to the web container, so `ghost start`, `ghost stop` and `ghost restart` do not
apply: `--restart` is the way.

### The default accounts

| Account | Role | Handle in the tests |
| --- | --- | --- |
| `administrator@example.com` | Administrator | `administrator` |
| `editor@example.com` | Editor | `editor` |
| `author@example.com` | Author | `author` |
| `contributor@example.com` | Contributor | `contributor` |

Each has the password of the workspace's other default lists. They are for local sites and for
tests; the owner of the site is the workspace account and is never written into a test.
`bash cmd-tools-add-users.sh mysite ghost` and `bash cmd-tools-cancel-users.sh mysite ghost` add
and remove the same list.

### Test a site

```bash
bash cmd-tools-testing.sh mysite                 # webship-js, the step pack, the users registry, a first feature
bash cmd-tools-testing.sh mysite --run           # run the suite in the container
bash cmd-tools-testing.sh mysite --run --path tests/features/site.feature
```

`cmd-tools-testing.sh` is the workspace's own. For a Ghost project it also adds
`@webship-js/ghost-steps` to `package.json`, lists its step definitions in `cucumber.js` after
webship-js's own, writes the users registry (the handles above, overridable with
`SITE_<HANDLE>_EMAIL` and `SITE_<HANDLE>_PASSWORD`) and the address of the mailbox (`mailUrl`),
places `tests/features/site.feature` when the project has none, and makes sure the default accounts
are on the site. Run it again and it adds what is missing and keeps what you changed.

## The AI items

`ai/` in the package holds one folder per kind, the manifest's `ai` block names each item, and
`--install` places it in the workspace folder of that kind.

| Kind | Item | Use it to |
| --- | --- | --- |
| Agent | `ghost-site-builder` | Build, update, restart, maintain or remove a Ghost site with the commands above, in containers only |
| Agent | `ghost-tester` | Set the testing stack up, look at the site in the Playwright MCP browser first, write scenarios from the pack's steps and run them; it never creates an account in a suite and never writes a platform name into a step phrase |
| Skill | `ghost-scenarios` | Write a scenario from phrases that exist: the pack's steps by area, the handles of the users registry, the traps found on a real site, and three features that pass on a fresh site |
| Command | `/ghost-test <site> [feature or @tag]` | Run the suite of a site from inside a session: set up when missing, match every step, run, report what failed and why |
| Prompt | `ghost-build-and-test` | Start a session that builds a site, says what it is, sets the testing stack up and runs the first feature |

After `--install` each is in its folder on the dashboard. **Install** there puts an agent, a skill
or a command into Claude Code (`~/.claude/agents`, `~/.claude/skills`, `~/.claude/commands`), or
from the command line:

```bash
cd ~/workspace/ai-agents   && bash cmd-tools-ai-items.sh ghost-tester --install
cd ~/workspace/ai-skills   && bash cmd-tools-ai-items.sh ghost-scenarios --install
cd ~/workspace/ai-commands && bash cmd-tools-ai-items.sh ghost-test --install
```

A prompt is not installed: it is the whole `claude …` launch command of a new session, and the
dashboard's **New screen** form lists it as a template. By hand, fill the placeholders in and run
the command of the file from the folder it names.

Every step phrase the items show is checked against the definitions of the step pack and of
webship-js (`tests/fixtures/step-definitions.txt`), and every command and flag against the
plugin's own.

## Develop it

```bash
npm install     # builds dist/ (TypeScript)
npm run lint
npm test        # the manifest, the commands, the AI items, the functions against a scaffolded project
```
