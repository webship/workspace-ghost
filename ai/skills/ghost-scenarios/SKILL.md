---
name: ghost-scenarios
description: Write and run webship-js scenarios for a self-hosted Ghost site of the Webship Workspace with the Ghost step pack (`@webship-js/ghost-steps`) — the phrases of the pack by area (the session and the staff roles, the admin screens and lists, the editor and publishing, tags, the settings, the front end, the membership form), the handles of the users registry, and the workspace command that runs them in the site's container. Use when asked to "write a scenario for this Ghost site", "test the editor role", "which step is there for the admin menu", "add a feature for publishing a post", or when a `.feature` file of a Ghost project is being written or fixed.
argument-hint: '<site> [what to cover]'
---

# ghost-scenarios

Scenarios for a self-hosted Ghost site of a Webship Workspace (`~/workspace`, container-based, DDEV
by default), written from the steps of [`@webship-js/ghost-steps`](https://github.com/webship/ghost-steps)
and of [webship-js](https://github.com/webship/webship-js) itself, and run in the site's container
by the workspace's own command. It comes with the Ghost plugin (`@webship.co/workspace-ghost`),
like the builder (`cmd-ghost-project.sh`), the Ghost-CLI tool (`cmd-tools-ghost-cli.sh`) and the
agents `ghost-site-builder` and `ghost-tester`.

## Where everything is

| What | Where |
| --- | --- |
| The site | `~/workspace/<folder>/<site>`, at `https://<site>.ddev.site`, the admin at `/ghost` (`<folder>` is a sites folder: `dev`, `test`, `sandboxes`, `demos`) |
| The suite's configuration | `<site>/cucumber.js`: the step definitions it loads, the users registry (`worldParameters.users`) and the mailbox of the site (`mailUrl`) |
| The features | `<site>/tests/features/*.feature` (`site.feature` is the first one the setup wrote) |
| The pack's steps | `<site>/node_modules/@webship-js/ghost-steps/tests/step-definitions/*.steps.js` |
| webship-js's steps | `<site>/node_modules/webship-js/tests/step-definitions/*.js` |
| The reports | `<site>/tests/reports/` |

## The order of work

1. **Make sure the testing stack is there.** From the sites folder:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <site>
   ```
   It adds webship-js, the step pack, the users registry, the address of the mailbox and
   `tests/features/site.feature`, and makes sure the default staff accounts are on the site. It is
   safe to run again: it adds what is missing and keeps what was changed.
2. **Read the installed steps before writing a phrase.** They are the source of truth: the pack
   moves, and a phrase from memory is a guess.
   ```bash
   cd ~/workspace/<folder>/<site>
   grep -hE "^(Given|When|Then)\(" node_modules/@webship-js/ghost-steps/tests/step-definitions/*.steps.js
   ```
   Every step carries a comment block with five examples above it; open the file when a phrase
   is not obvious.
3. **Look at the screen first** (the Playwright MCP browser, a tab of your own) when the scenario
   is about a screen you have not seen. The admin is a single-page application: what a screen
   shows, and to which role, is only known once it has rendered.
4. **Write the feature** in `<site>/tests/features/`, from phrases that exist (the lists below).
5. **Match every step without a browser**, then run the feature, then the suite:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <site> --dry-run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <site> --run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <site> --run --tags "@critical"
   bash cmd-tools-testing.sh <site> --run
   ```
   A dry run says `Undefined` for a phrase no definition matches: fix the phrase, do not write a
   step for it.

## Accounts: a handle, never a password

A scenario signs in by a handle of the users registry. The default staff accounts are on the site
already (`bash cmd-tools-ghost-cli.sh <site> --add-users` adds them again if they were removed):

| Handle | Account | Role |
| --- | --- | --- |
| `administrator` | `administrator@example.com` | Administrator |
| `editor` | `editor@example.com` | Editor |
| `author` | `author@example.com` | Author |
| `contributor` | `contributor@example.com` | Contributor |

```gherkin
Given I am logged in to the admin as "editor"
Then I should be logged in to the admin as "editor"
And the user menu should show "editor@example.com"
```

The pack's own features also sign in as `owner`. Here the owner of the site is the workspace
account, which is not in the registry: write the scenario for `administrator`.

## The phrases, by area

Each line is a phrase the pack defines, and each one passed on a site built with
`bash cmd-ghost-project.sh <site> --install --add-users` (the names in quotes are that site's: its
first post, its first page, its tag). Most `should` steps also take the negative: `should not
see`, `should not be`, `should not offer`.

### The session

```gherkin
Given I am an anonymous user
Given I am logged in to the admin as "editor"
When I log out of the admin
Then I should be logged in to the admin as "editor"
Then I should not be logged in to the admin
Then the user menu should show "editor@example.com"
When I try to log in to the admin with the email "editor@example.com" and the password "not-the-password"
Then I should see the sign in error "Your password is incorrect."
```

### Admin screens, by the name on the menu

```gherkin
When I go to the admin screen "Posts"
Then I should be on the admin screen "Posts"
Then the admin screen "Settings" should not be available
Then I should be on the admin screen "sign in"
Then I should see "Tags" in the admin menu
Then I should not see "Members" in the admin menu
When I click "Pages" in the admin menu
When I search the admin for "Coming soon"
Then I should see the admin search result "Coming soon"
When I open the admin search result "Coming soon"
Then I should see the notification "Post reverted to a draft."
Then I should see the dialog "Invite a new staff user"
When I answer the dialog with "Close"
```

The screens that have a name: `Analytics`, `Posts`, `Drafts`, `Scheduled`, `Published`, `Pages`,
`Tags`, `New tag`, `Members`, `New member`, `Comments`, `Settings`, `Staff`, `New post`,
`New page`, `sign in`.

### The lists, the tags and the staff

```gherkin
Then I should see the page "About this site" in the list
Then the page "About this site" should have the status "Published" in the list
Then I should not see the post "A post from the suite" in the list
Then I should see the tag "News" in the list
Then the tag "News" should have 1 post
When I set the tag name to "A tag from the suite"
Then the tag slug should be "a-tag-from-the-suite"
When I set the tag description to "Made by the suite."
When I save the tag
When I open the tag "A tag from the suite" from the list
When I delete the tag
Then I should see the staff user "editor" with the role "Editor"
When I open the staff user "author"
Then the staff user email should be "author@example.com"
Then the staff user role should be "Author"
When I close the staff user
Then the staff invitation should offer the role "Contributor"
```

A tag is made on the screen `New tag`. The staff steps open the Staff settings themselves, and
`the staff invitation should offer the role` opens the invitation dialog and sends nothing: close
it with `When I answer the dialog with "Close"`.

### The editor and publishing

```gherkin
Given there is no post titled "A post from the suite"
When I start a new post
When I set the editor title to "A post from the suite"
When I write "Published by the suite." in the editor
When I wait for the editor to save
When I add the tag "News" to the post
Then the post should have the tag "News"
When I set the excerpt to "An excerpt."
Then the excerpt should be "An excerpt."
Then the post URL should be "a-post-from-the-suite"
When I preview the post
Then the preview should show "Published by the suite."
When I close the preview
When I open the publish dialog
Then the publish dialog should say "Ready, set, publish."
When I publish the post
Then the publish confirmation should say "A post from the suite"
When I close the publish confirmation
When I open the editor of the post "A post from the suite"
Then the editor title should be "Coming soon"
Then the editor status should be "Published"
Then the editor should offer "Update"
Then the post settings should offer "Excerpt"
When I unpublish the post
When I delete the post from the editor
```

`post` and `page` are interchangeable in every one of these. A contributor writes drafts and has
no Publish button:

```gherkin
Then the editor status should be "Draft"
Then the editor should not offer "Publish"
Then the editor should offer "Preview"
Then the post settings should not offer "Tags"
```

### The settings

```gherkin
When I go to the settings section "Title & description"
Then the settings section "Title & description" should show "dev mysite"
When I open the navigation settings
Then the navigation settings should list the link "Home"
```

### The front end

```gherkin
When I go to the homepage
Then the page should be the home page
Then the page should be a post
Then the page should be a page
Then the page should be the tag archive of "news"
Then the page generator should start with "Ghost 6"
Then I should see the post "Coming soon" in the post feed
Then the post feed should have 1 post
Then I should see "About" in the site navigation
Then the archive should be on page 1
Then the archive should not have a next page
Then the post should not be restricted to members
Then I should see a subscribe button
When I open the site search
When I search the site for "Coming"
Then I should see the site search result "Coming soon"
When I close the site search
When I open the membership sign up form
Then the membership form should show "Sign up"
When I close the membership form
Then I should not be signed in as a member
```

`I am an anonymous user`, `I go to the homepage`, `I go to "/about/"`, `I should see "<text>"`,
`I press the key "Escape"` and `the response status code should be 200` are webship-js's own
steps; its status codes, classes, landmarks and accessibility audits are used as they are and
never redefined for this platform.

## Traps found on a real site

- `the user menu should show "…"` opens the user menu and leaves it open, and
  `When I log out of the admin` then cannot click it. Close it first:
  ```gherkin
  Then the user menu should show "editor@example.com"
  When I press the key "Escape"
  And I log out of the admin
  ```
- An Editor has `Settings` in the admin menu and has no `Members`: the menu of an Editor is
  `Posts` (with `Drafts`, `Scheduled`, `Published`), `Pages`, `Tags`, `Settings` and `Help`.
  Assert the menu of a role from what the screen showed, not from what the role's name suggests.
- A site as built has one post (`Coming soon`), one page (`About this site`, at `/about/`), one
  tag (`News`) and the navigation `Home` and `About`. The pack's own features
  (`node_modules/@webship-js/ghost-steps/tests/features/`) are written for the pack's seeded test
  site (`Travel diary 8`, the tag `Guides`): copy the shape, replace every title.
- A site title is `<folder> <site>` after a build (`dev mysite`), until somebody changes it.
- A scenario that failed half way leaves its post behind. Open it with
  `Given there is no post titled "<title>"` (and `there is no tag named "<name>"`), so the next
  run starts clean.

## Rules

- **No staff account is created in a suite.** No invitation that is sent, no call to the Admin API
  in a hook that adds a user. A role the registry does not have is asked for, not made. A member
  is content, not staff: a membership scenario may create one, and removes it again
  (`Given there is no member with the email "<address>"`).
- **Never the workspace account.** The owner of the site is not in the registry.
- **No password in a feature file**, except where a wrong password is the subject.
- **No platform name in a step phrase**: `I am logged in to the admin as "editor"`, never a phrase
  that names the product. The same holds for a custom step.
- **No selector and no route when a step says it**: `the admin screen "Staff"`, not the route of
  the screen.
- **What a scenario creates, it removes** in the same scenario, under a title nobody else uses.
- **Nothing is e-mailed outside and nothing is paid for.** The mail of the site goes to the
  mailbox of the container; no hosted service and no payment provider is connected.
- **A custom step is the last resort**: look in the pack and in webship-js first, write it in
  `<site>/tests/step-definitions/` with a comment block and examples, and say it may belong in
  the pack.
- **Everything runs in the container**, through `cmd-tools-testing.sh`. Never `npx cucumber-js`
  or `npx playwright` on the host.
- **A failing scenario is a result.** No `@wip`, no longer timeout, no looser assertion to turn a
  run green: say what the site did.

## Examples that run

`examples/` holds three features that pass on a site built with
`bash cmd-ghost-project.sh <site> --install --add-users`. Copy one into the suite and run it:

```bash
cp ~/workspace/ai-skills/ghost-scenarios/examples/roles-and-screens.feature ~/workspace/<folder>/<site>/tests/features/
cd ~/workspace/<folder>
bash cmd-tools-testing.sh <site> --run --path tests/features/roles-and-screens.feature
```

| Feature | What it shows |
| --- | --- |
| `examples/roles-and-screens.feature` | Each staff role reaching, or being refused, an admin screen; the admin menu of a role; the staff list |
| `examples/post-lifecycle.feature` | An editor writing, publishing, viewing, unpublishing and deleting a post: content a scenario creates and removes |
| `examples/front-end.feature` | A visitor on the home page, a page, a tag archive and the search of the site, with no session |

## The book

For any automated functional testing in this work (a Gherkin feature, a step definition, choosing a
step, a test run and its failures), read the book *Automated Functional Testing Recipes* first.

- **Where.** Use the first that exists: `.claude/automated-functional-testing-recipes/` in the project,
  `~/.claude/automated-functional-testing-recipes/` (installed by webship/webship-js-ai-agent,
  webship/webship-js-skills or webship/ai-agents), or
  https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes
- **How.** Its `README.md` first, then the chapter that matches the task (one file per chapter,
  named by its subject), not the single complete file.
- **Which wins.** The installed webship-js package and the step pack are the source of truth for
  step phrasing. When they differ from the book, follow them and say so.
- **For Ghost.** Start with `ch26-testing-cms-applications.md` (content, publishing, media and
  taxonomy), `ch10-authentication-authorization.md` (logins, sessions and access by role),
  `ch33-complete-step-definition-reference.md` (every built-in step) and `ch21-when-tests-go-bad.md`
  (flaky, brittle and slow scenarios).
