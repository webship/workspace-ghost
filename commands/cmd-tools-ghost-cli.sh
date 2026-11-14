#!/usr/bin/env bash

# Installed by the Ghost plugin (plugins.sh --install ghost); __WORKSPACE__ is the workspace it was installed into.
#
# Ghost-CLI for one Ghost project of this workspace, in its container: say what the site is,
# run a Ghost-CLI command, update Ghost, restart it, add or remove the default staff accounts.
# Nothing here runs on the host.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Distribution.
distribution_name="ghost";

ARGPARSE_DESCRIPTION="Run Ghost-CLI on a Ghost project of __WORKSPACE__: status, a command, an update, a restart, the default accounts"
# The args file comes with the plugin: core/scripts/plugins/ghost/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/ghost/args/arg-ghost-cli.sh || exit 1 ;

shift $#;

ghost_cli_tool ;
