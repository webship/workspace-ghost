#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The Ghost project in this workspace.')
parser.add_argument('-r', '--run',
                    default="_none_",
                    help='A Ghost-CLI command to run in the project, without the leading ghost. Example: --run "doctor"')
parser.add_argument('-u', '--update',
                    action='store_true',
                    default=False,
                    help='Update Ghost to the latest release and start it again.')
parser.add_argument('-s', '--restart',
                    action='store_true',
                    default=False,
                    help='Start Ghost again, and wait until it answers.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='Add the default staff accounts, one per role. An account that is already there is left as it is.')
parser.add_argument('-c', '--cancel-users',
                    action='store_true',
                    default=False,
                    help='Delete the default staff accounts and what they wrote.')
ARGEOF
