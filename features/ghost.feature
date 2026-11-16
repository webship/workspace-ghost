Feature: The Ghost plugin on the dashboard
  Once the plugin is activated and installed, the sites folders offer the Ghost builder, each
  AI folder lists the items of its kind the plugin ships, and the Plugins page lists the plugin
  with its steps.

  # The Plugins page names each plugin; the package is on the plugin's own page (the row shows it on hover only).
  Scenario: The plugin is listed on the Plugins page, and its own page names its package
    Given I am on "/settings/plugins"
     Then I should see "Ghost"
     When I go to "/settings/plugin/ghost"
     Then I should see "@webship.co/workspace-ghost"

  Scenario: A sites folder offers the Ghost builder
    Given I am on "/dev"
     Then "option[value='cmd-ghost-project.sh']" should be attached

  # The AI folders are searched by name: with every plugin on, a folder lists more than one page of items.
  Scenario: The AI Agents folder lists the agents the plugin ships
    Given I am on "/ai-agents?q=ghost-"
     Then I should see "ghost-site-builder"
      And I should see "ghost-tester"

  Scenario: The AI Skills folder lists the skill the plugin ships
    Given I am on "/ai-skills?q=ghost-scenarios"
     Then I should see "ghost-scenarios"

  Scenario: The AI Commands folder lists the command the plugin ships
    Given I am on "/ai-commands?q=ghost-test"
     Then I should see "ghost-test"

  Scenario: The AI Prompts folder lists the prompt the plugin ships
    Given I am on "/ai-prompts?q=ghost-build-and-test"
     Then I should see "ghost-build-and-test"
