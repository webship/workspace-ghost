Build a self-hosted Ghost site in a sites folder and prove it with its first webship-js feature.

`claude` is the default launcher; the text between the triple quotes is plain and can be given to another AI CLI as it is.

```
claude --permission-mode bypassPermissions """
Build a Ghost site named <name> in this sites folder and test it with webship-js
# ~/workspace/<dev|test|sandboxes|demos> · https://<name>.ddev.site · container-based (DDEV by default)
# the builder deletes a project of the same name first: stop if <name> is a site somebody still needs
# nothing on the host: no ghost, node, npm or mysql outside the site's container
# open source and self-hosted: no hosted service, no payment provider, no vendor account
# a feature to write or a run to read: the book Automated Functional Testing Recipes first (its README.md, then the matching chapter), from .claude/automated-functional-testing-recipes/ in the project, ~/.claude/automated-functional-testing-recipes/ or https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes

1. bash cmd-ghost-project.sh <name> --install --add-users
   (add --version <x> for a release other than the latest)
   if it says the setup waits at /ghost, the workspace account's password is under 10 characters: stop and tell me
2. bash cmd-tools-ghost-cli.sh <name>
   tell me the version, the address and the staff accounts it lists
3. bash cmd-tools-testing.sh <name>
   webship-js, the step pack, the users registry, the mailbox and tests/features/site.feature
4. bash cmd-tools-testing.sh <name> --dry-run --path tests/features/site.feature
5. bash cmd-tools-testing.sh <name> --run --path tests/features/site.feature

If a command fails, show the line that failed and stop. Do not retry with other flags.
When the feature is green: the address, the version, how many scenarios and steps passed.
Then ask me whether to keep the site or remove it with: bash cmd-tools-remove.sh <name>
"""
```
