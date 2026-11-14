#!/usr/bin/env bash

# Ghost for the Webship Workspace: build a self-hosted site, run Ghost-CLI on it, add its default
# staff accounts, and wire its step pack into the testing setup.
#
# Placed by `plugins.sh --install ghost` in core/scripts/plugins/ghost/functions/, where bootstrap
# sources it after the core's own functions. Everything runs in the project's container (DDEV by
# default), never on the host: the web container runs Node.js and starts Ghost as an extra daemon,
# the router serves it at the project's address, MySQL 8 is the container tool's database, and the
# mail of the site goes to the mailbox of the container. No hosted service and no payment provider
# is connected.
#
# Ghost is not a PHP platform and DDEV has no project type for it, so a Ghost project is recognised
# by a file (.ddev/config.ghost.yaml, written by the builder), and four names are the ones the
# core's tools look for:
#   set_ghost_users          the default staff accounts          (cmd-tools-add-users.sh <project> ghost)
#   add_ghost_users          create them through the Admin API   (the same tool, and --add-users of the builder)
#   cancel_ghost_users       delete them                         (cmd-tools-cancel-users.sh <project> ghost)
#   testing_configure_ghost  the step pack in the testing stack  (cmd-tools-testing.sh <project>)

# The step pack a Ghost project is tested with, and the release line it is required at.
readonly GHOST_STEPS_PACKAGE='@webship-js/ghost-steps';
readonly GHOST_STEPS_VERSION='^2.0.0';

# Ghost-CLI, the official installer and command line, run with npx in the container.
readonly GHOST_CLI_PACKAGE='ghost-cli@latest';

# Where Ghost lives in the web container, and the port it listens on.
readonly GHOST_DIR='/var/www/html/ghost';
readonly GHOST_PORT='2368';

# The default staff accounts: one per role, the ones a scenario signs in as. Accounts are
# configuration, created once on the site; a test suite never creates or deletes one. The owner of
# the site is the workspace account and is not in this list.
function set_ghost_users() {
  users=(administrator editor author contributor);
  local user ;
  for user in "${users[@]}" ; do
    printf -v "user_${user}_name" '%s' "${user}" ;
    printf -v "user_${user}_mail" '%s' "${user}@example.com" ;
    printf -v "user_${user}_password" '%s' 'dD.123123ddd' ;
    # The roles of Ghost are written with a capital: Administrator, Editor, Author, Contributor.
    printf -v "user_${user}_role" '%s' "${user^}" ;
  done
}

# Is this folder a Ghost project? The builder leaves .ddev/config.ghost.yaml in it.
function ghost_is_project() {
  local project_path="$1";
  [ -f "${project_path}/.ddev/config.ghost.yaml" ] ;
}

# Go to the project a tool was asked about, or say why not.
function ghost_enter_project() {
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}";
  if [ ! -d "${project_path}" ] ; then
    echo "No project ${PROJECT_NAME} in ${WORKSPACE_ROOT}/${doc_name}." ;
    return 1 ;
  fi
  if ! ghost_is_project "${project_path}" ; then
    echo "${doc_name}/${PROJECT_NAME} is not a Ghost project (it has no .ddev/config.ghost.yaml)." ;
    return 1 ;
  fi
  cd "${project_path}" || return 1 ;
}

# What the container tool is told about Ghost: the router sends the project's address to Ghost's
# port, and Ghost runs as a daemon of the web container once the build has finished.
function ghost_write_ddev_config() {
  local project_path="$1";
  mkdir -p "${project_path}/.ddev" || return 1 ;
  cat > "${project_path}/.ddev/config.ghost.yaml" <<YAMLEOF
# Ghost in this project. Written by the Ghost builder of the workspace; build again rather than
# editing by hand. The web container serves no files of its own: the router sends ports 80 and 443
# of the project's address to Ghost, which the web container runs as a daemon.
web_extra_exposed_ports:
  - name: ghost
    container_port: ${GHOST_PORT}
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: ghost
    command: "bash -c 'while [ ! -f ${GHOST_DIR}/.ready ]; do sleep 2; done; cd ${GHOST_DIR} && NODE_ENV=production exec node current/index.js'"
    directory: /var/www/html
YAMLEOF
}

# Node.js in the web image itself. The container tool installs the Node.js of the project when the
# container starts, after the daemons have started and within a short time limit: on a slow
# connection, or offline, Ghost would be started on the image's older Node.js and refuse to run.
# Baked into the image, the Node.js Ghost needs is there before anything starts, on every restart.
function ghost_write_web_build() {
  local project_path="$1" nodejs_version="$2";
  mkdir -p "${project_path}/.ddev/web-build" || return 1 ;
  cat > "${project_path}/.ddev/web-build/Dockerfile.ghost" <<DOCKEREOF
# Node.js ${nodejs_version} in the web image, so Ghost has it before the container's daemons start.
# Written by the Ghost builder of the workspace; build again rather than editing by hand.
RUN N_PREFIX=/usr/local n install ${nodejs_version} && node --version
DOCKEREOF
}

# The configuration of the site: the container's own database (db/db/db), the mailbox of the
# container, no update check and no call to an outside service. Nothing personal is written.
function ghost_write_config() {
  local project_path="$1" base_url="$2" title="$3";
  cat > "${project_path}/ghost/config.production.json" <<JSONEOF
{
  "url": "${base_url}",
  "server": { "host": "0.0.0.0", "port": ${GHOST_PORT} },
  "database": {
    "client": "mysql",
    "connection": { "host": "db", "port": 3306, "user": "db", "password": "db", "database": "db" }
  },
  "mail": {
    "transport": "SMTP",
    "from": "'${title}' <noreply@example.com>",
    "options": { "host": "127.0.0.1", "port": 1025, "secure": false, "ignoreTLS": true }
  },
  "logging": { "transports": ["file", "stdout"] },
  "process": "local",
  "paths": { "contentPath": "${GHOST_DIR}/content" },
  "privacy": { "useTinfoil": true },
  "explore": { "update_url": "" },
  "security": { "staffDeviceVerification": false },
  "spam": {
    "user_login": { "freeRetries": 100000 },
    "staff_invite_block": { "freeRetries": 100000 },
    "member_login": { "freeRetries": 100000 },
    "global_block": { "freeRetries": 100000 },
    "global_reset": { "freeRetries": 100000 },
    "private_block": { "freeRetries": 100000 },
    "content_api_key": { "freeRetries": 100000 },
    "email_preview_block": { "freeRetries": 100000 },
    "webmentions_block": { "freeRetries": 100000 }
  }
}
JSONEOF
}

# Ghost-CLI in the container, in the folder of the site.
function ghost_cli() {
  ddev exec -d "${GHOST_DIR}" "npx --yes ${GHOST_CLI_PACKAGE} $*" ;
}

# The release of Ghost the project runs.
function ghost_version() {
  ddev exec "node -p \"require('${GHOST_DIR}/current/package.json').version\"" 2>/dev/null ;
}

# The address the site is configured with.
function ghost_site_url() {
  sed -n 's/^ *"url": *"\([^"]*\)".*/\1/p' ghost/config.production.json 2>/dev/null | head -n 1 ;
}

# Wait until Ghost answers on its own port. It creates its tables on the first start, so the
# first wait is the long one.
function ghost_wait() {
  local attempt ;
  for attempt in $(seq 1 120) ; do
    if ddev exec "curl -fsS -o /dev/null -H 'X-Forwarded-Proto: https' http://127.0.0.1:${GHOST_PORT}/ghost/api/admin/site/" > /dev/null 2>&1 ; then
      return 0 ;
    fi
    sleep 5 ;
  done
  echo "Ghost did not start; the end of its log:" ;
  ddev exec "tail -n 40 ${GHOST_DIR}/content/logs/*.log" 2>/dev/null ;
  return 1 ;
}

# Start Ghost again (the daemon of the web container), and wait for it.
function ghost_restart() {
  ddev exec "supervisorctl restart webextradaemons:ghost" || return 1 ;
  ghost_wait ;
}

# Run a verb of ghost-accounts.js (installed, setup, add, cancel, list) in the container. The
# script is piped to node, and what it needs travels as base64 of a JSON object, so no password is
# written into a file of the project and no quoting can break a value.
function ghost_accounts() {
  local verb="$1" script="${WORKSPACE_SCRIPTS}/plugins/ghost/ghost-accounts.js" rows="" user name mail password role payload ;
  if [ ! -f "${script}" ] ; then
    echo "ghost-accounts.js is not in ${WORKSPACE_SCRIPTS}/plugins/ghost: install the plugin (plugins.sh --install ghost)." ;
    return 1 ;
  fi
  for user in "${users[@]}" ; do
    name="user_${user}_name"; mail="user_${user}_mail"; password="user_${user}_password"; role="user_${user}_role";
    rows="${rows}${!name}"$'\x1f'"${!mail}"$'\x1f'"${!password}"$'\x1f'"${!role}"$'\x1e' ;
  done
  payload="$(GHOST_SITE_URL="${ghost_url:-$(ghost_site_url)}" GHOST_SITE_TITLE="${ghost_title:-}" \
    GHOST_OWNER_NAME="${account_name}" GHOST_OWNER_MAIL="${account_mail}" GHOST_OWNER_PASS="${account_pass}" \
    GHOST_STAFF="${rows}" python3 -c '
import base64, json, os
staff = [dict(zip(("name", "email", "password", "role"), row.split("\x1f"))) for row in os.environ["GHOST_STAFF"].split("\x1e") if row]
print(base64.b64encode(json.dumps({
    "url": os.environ["GHOST_SITE_URL"], "title": os.environ["GHOST_SITE_TITLE"],
    "owner": {"name": os.environ["GHOST_OWNER_NAME"], "email": os.environ["GHOST_OWNER_MAIL"], "password": os.environ["GHOST_OWNER_PASS"]},
    "staff": staff,
}).encode()).decode())')" || return 1 ;
  ddev exec "GHOST_ACCOUNTS=${payload} node - ${verb}" < "${script}" ;
}

# Build a Ghost site from nothing: the container, the code, and with --install the site itself.
function ghost_build() {
  trim_project_name ;
  local base_url="https://${PROJECT_NAME}.ddev.site" ;
  local version="${VERSION:-${site_version:-latest}}" ;
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}" ;
  local title="${doc_name} ${PROJECT_NAME}" ;
  [ "${version}" == 'latest' ] && version="" ;

  cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;

  drop_database ;
  rm -rf "${PROJECT_NAME}" ;
  mkdir -p "${PROJECT_NAME}/ghost" ;
  cd "${project_path}" || exit 1 ;

  # A generic web server: no nginx and no PHP are started. Ghost needs MySQL 8.
  ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name=${PROJECT_NAME} \
    --database=mysql:8.0 --nodejs-version=$(ddev_nodejs_version) || exit 1 ;
  ghost_write_ddev_config "${project_path}" || exit 1 ;
  ghost_write_web_build "${project_path}" "$(ddev_nodejs_version)" || exit 1 ;
  ddev_up start -y || exit 1 ;

  # The official install path: Ghost-CLI downloads the release and its dependencies. --no-setup:
  # the configuration is written below instead of asked for.
  echo "Installing Ghost ${version:-(the latest release)} with Ghost-CLI. This takes a few minutes." ;
  ghost_cli install ${version} --no-setup --no-stack --no-start --no-prompt --dir "${GHOST_DIR}" \
    || { echo "ghost install failed." ; exit 1 ; } ;

  ghost_write_config "${project_path}" "${base_url}" "${title}" ;
  touch "${project_path}/ghost/.ready" ;
  echo "Starting Ghost. The first start creates the tables." ;
  ghost_restart || exit 1 ;

  if [ "${INSTALL}" == 'yes' ] ; then
    # Ghost refuses a password under 10 characters, and the owner is the workspace account.
    if [ "${#account_pass}" -lt 10 ] ; then
      echo "Ghost asks for a password of 10 characters or more, and the workspace account's is shorter" ;
      echo "(account: pass in core/config/settings.yml). The site is built; finish its setup at ${base_url}/ghost" ;
      exit 1 ;
    fi
    ghost_url="${base_url}" ; ghost_title="${title}" ;
    users=() ;
    ghost_accounts setup || { echo "The setup of the site failed." ; exit 1 ; } ;

    if [ "${ADD_USERS}" == 'yes' ] ; then
      set_ghost_users ;
      add_ghost_users ;
      cd "${project_path}" || exit 1 ;
    fi

    echo "${doc_name} ${PROJECT_NAME} has been installed: Ghost $(ghost_version).";
    echo "Go to ${base_url}/ghost and sign in as ${account_mail}";
  else
    [ "${ADD_USERS}" == 'yes' ] && echo "--add-users needs --install: there is no site to add accounts to yet." ;
    echo "${doc_name} ${PROJECT_NAME} is ready to set up: Ghost $(ghost_version).";
    echo "Go to ${base_url}/ghost";
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    ddev launch ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# Create the default staff accounts through the Admin API: each is invited, and the invitation is
# accepted from the mailbox of the container. An account that is already there is left as it is.
# The list is loaded by the caller (set_ghost_users): the core's add_users, the builder, the CLI tool.
function add_ghost_users() {
  ghost_enter_project || return 1 ;
  local user user_name user_mail user_password user_role ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail";
    user_password="user_${user}_password"; user_role="user_${user}_role";

    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo "      User mail: ${!user_mail}";
    echo "  User password: ${!user_password}";
    echo "      User role: ${!user_role}";
    echo " ================================================================= ";
  done
  ghost_accounts add ;
  local status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# Delete the default staff accounts, and what they wrote.
function cancel_ghost_users() {
  ghost_enter_project || return 1 ;
  local user user_mail ;
  for user in "${users[@]}" ; do
    user_mail="user_${user}_mail";
    echo " ---------------------------------------------------------------- ";
    echo "      User mail: ${!user_mail}";
    echo " ================================================================= ";
  done
  ghost_accounts cancel ;
  local status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# What cmd-tools-ghost-cli.sh does: the first of --run, --update, --restart, --add-users,
# --cancel-users that was asked for; with none of them, what the site is.
function ghost_cli_tool() {
  trim_project_name ;
  ghost_enter_project || exit 1 ;

  if ! ddev describe -j 2>/dev/null | grep -q '"status":"running"' ; then
    ddev start -y || exit 1 ;
  fi

  if [ ! "${RUN}" == '_none_' ] ; then
    # Unquoted on purpose: --run "config get url" is a command and its arguments.
    ghost_cli ${RUN} ;
    exit $? ;
  fi

  if [ "${UPDATE}" == 'yes' ] ; then
    echo "Ghost $(ghost_version) is installed." ;
    # Ghost-CLI does not manage the process here (the web container does): update, then start again.
    ghost_cli update --no-restart --no-prompt || exit 1 ;
    ghost_restart || exit 1 ;
    echo "Ghost $(ghost_version) is running." ;
  elif [ "${RESTART}" == 'yes' ] ; then
    ghost_restart || exit 1 ;
    echo "Ghost $(ghost_version) is running." ;
  elif [ "${ADD_USERS}" == 'yes' ] ; then
    set_ghost_users ;
    add_ghost_users ;
  elif [ "${CANCEL_USERS}" == 'yes' ] ; then
    set_ghost_users ;
    cancel_ghost_users ;
  else
    echo "${doc_name}/${PROJECT_NAME}: Ghost $(ghost_version) at $(ghost_site_url)" ;
    echo "" ; echo "Accounts:" ;
    users=() ;
    if ghost_accounts installed ; then
      ghost_accounts list ;
    else
      echo "   The site is not set up yet: finish its setup at $(ghost_site_url)/ghost" ;
    fi
  fi
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The step pack in the testing stack of a Ghost project. The core's testing_configure calls this in
# the project folder once webship-js is scaffolded and before the dependencies are installed; for a
# project that is not Ghost it changes nothing.
#
# It adds the pack to package.json, lists its step definitions in cucumber.js after webship-js's
# own, gives cucumber.js the users registry of the default staff accounts (a handle a scenario
# reads, mapped to an account; never the workspace account), the address of the mailbox the
# membership steps read and the pack's setting for the JavaScript errors of the admin, and writes a first feature when the project has none of its own. Every
# part is skipped when it is already there, so a second run adds what the first missed and never
# resets a suite.
function testing_configure_ghost() {
  local project_path="$1";
  ghost_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  Ghost: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi

  echo "Adding the Ghost step pack (${GHOST_STEPS_PACKAGE} ${GHOST_STEPS_VERSION}).";
  set_ghost_users ;
  local registry="" user user_name user_mail user_password user_role ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail";
    user_password="user_${user}_password"; user_role="user_${user}_role";
    registry="${registry}${user}|${!user_name}|${!user_role}|${!user_mail}|${!user_password}"$'\n' ;
  done

  python3 - "${project_path}" "${GHOST_STEPS_PACKAGE}" "${GHOST_STEPS_VERSION}" 'SITE' "${registry}" <<'PYEOF' || return 1
import json, re, sys

project, pack, version, prefix, registry = sys.argv[1:6]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on.
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=2) + '\n')
    print('  package.json: %s %s' % (pack, version))

# cucumber.js: the pack's step definitions after webship-js's own, the users registry, the mailbox.
cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/**/*.js'," % pack
    core = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if core:
        src = src[:core.end()] + '\n' + core.group(1) + line + src[core.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
if not re.search(r"^[ \t]*users:[ \t]*\{", src, re.M):
    if not world:
        sys.exit("  cucumber.js has no worldParameters block to add the users registry to.")
    pad = world.group(1) + '  '
    rows = [r.split('|') for r in registry.splitlines() if r.strip()]
    block = [
        pad + "// The users registry: a handle a scenario reads, mapped to a staff account of this site (the default",
        pad + "// accounts: cmd-tools-add-users.sh). Override one with %s_<HANDLE>_EMAIL and %s_<HANDLE>_PASSWORD." % (prefix, prefix),
        pad + "users: {",
    ]
    for handle, name, role, mail, password in rows:
        env = '%s_%s' % (prefix, handle.upper())
        block.append(pad + "  %s: { name: '%s', role: '%s', email: process.env.%s_EMAIL || '%s', password: process.env.%s_PASSWORD || '%s' }," % (handle, name, role, env, mail, env, password))
    block.append(pad + "},")
    src = src[:world.end()] + '\n' + '\n'.join(block) + src[world.end():]
    print('  cucumber.js: the users registry (%s)' % ', '.join(r[0] for r in rows))

if world and not re.search(r"^[ \t]*mailUrl:", src, re.M):
    world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
    pad = world.group(1) + '  '
    block = [
        pad + "// The mailbox that catches the mail of the site (the one of the project's container): the membership",
        pad + "// steps read the sign in link from it. No e-mail leaves the machine.",
        pad + "mailUrl: process.env.MAIL_URL || (process.env.LAUNCH_URL || process.env.DDEV_PRIMARY_URL || '').replace(/\\/+$/, '') + ':8026',",
    ]
    src = src[:world.end()] + '\n' + '\n'.join(block) + src[world.end():]
    print('  cucumber.js: the mailbox of the site (mailUrl)')

if world and not re.search(r"^[ \t]*javascript:", src, re.M):
    world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
    pad = world.group(1) + '  '
    block = [
        pad + "// JavaScript errors the page raises: 'warn' reports them, 'fail' fails the scenario, 'off' ignores them; @js-fail, @js-warn and @js-off per scenario.",
        pad + "// Off by default here: the admin logs an error for every request a signed-out or restricted user is refused, which is what many scenarios are about.",
        pad + "javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'off', levels: ['error'], ignore: '', beforeScenario: false, afterScenario: true },",
    ]
    src = src[:world.end()] + '\n' + '\n'.join(block) + src[world.end():]
    print('  cucumber.js: JavaScript errors of the admin are not reported (javascript.mode)')

if src != before:
    open(cucumber_file, 'w').write(src)
PYEOF

  # A first feature, when the project has none for the site yet: the front page, the sign in
  # screen, each default account in its role.
  local feature="${WORKSPACE_SCRIPTS}/plugins/ghost/site.feature" ;
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/site.feature" ] ; then
    mkdir -p "${project_path}/tests/features" && cp "${feature}" "${project_path}/tests/features/site.feature" \
      && echo "  tests/features/site.feature: a first feature for the site" ;
  fi

  # The scenarios sign in as the default accounts: make sure a site that is set up has them.
  if ghost_wait > /dev/null 2>&1 && ( users=() ; ghost_accounts installed ) > /dev/null 2>&1 ; then
    ( add_ghost_users > /dev/null ) && echo "  the default accounts are on the site (${users[*]})" ;
  fi
}
