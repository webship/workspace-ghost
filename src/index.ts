/**
 * Ghost for Webship Workspace: a platform plugin.
 *
 * What the package carries is placed by the installer from the manifest: the builder and the
 * Ghost-CLI tool in the sites folders, their functions, argparse and the accounts script under
 * core/scripts/plugins/ghost/, the agents in the AI Agents folder. The dashboard needs nothing
 * drawn for it: the builder is in the Build list because it is a cmd-*-project.sh, the row menus
 * are the core's, the agents are listed like any other. What register() adds is what the
 * assistant is told.
 *
 * Everything the dashboard is asked for goes through `api`; this package requires nothing from the
 * dashboard's own files, so it can be installed from npm and removed without a trace.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';

/** The plugin's name, which its functions are named after. */
export const PLATFORM = 'ghost';

/** The commands the installer places in every sites folder. */
export const COMMANDS = ['cmd-ghost-project.sh', 'cmd-tools-ghost-cli.sh'];

/** The agents the installer places in the AI Agents folder. */
export const AGENTS = ['ghost-site-builder', 'ghost-tester'];

/** What the assistant is told about Ghost in this workspace. */
export function assistantContext(): string {
  return [
    'Ghost (a plugin, @webship.co/workspace-ghost): a self-hosted Ghost site is built with',
    '`bash cmd-ghost-project.sh <name> --install --add-users` from a sites folder (dev, test, sandboxes, demos),',
    'in a container like every other project, at https://<name>.ddev.site (the admin at /ghost).',
    '`bash cmd-tools-ghost-cli.sh <name>` says what the site is; `--run "<ghost-cli command>"` runs Ghost-CLI in it,',
    '`--update` updates Ghost, `--restart` starts it again, `--add-users` adds the default staff accounts (one per role).',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the Ghost step pack; `--run` runs the suite.',
    `For Ghost work, hand over to the agents ${AGENTS.map((a) => `\`${a}\``).join(' and ')}.`,
    'Never run ghost, node, npm or mysql on the host for a project; the owner of a site is the workspace account,',
    'and no hosted service or payment provider is connected.',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
