#!/usr/bin/env bash

# workspace-name: Ghost (latest)

# Installed by the Ghost plugin (plugins.sh --install ghost); __WORKSPACE__ is the workspace it was installed into.
#
# Build a self-hosted Ghost site in a container: the latest release, or the one --version names, at
# https://<name>.ddev.site. With --install the site is set up with the workspace account as its
# owner; with --add-users it also gets the default staff accounts, one per role.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Set site version.
site_version="latest";

# Distribution.
distribution_name="ghost";
distribution_title="Ghost";
distribution_webroot="";

ARGPARSE_DESCRIPTION="Build a ${distribution_title} project in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/ghost/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/ghost/args/arg-ghost.sh || exit 1 ;

shift $#;

ghost_build ;
