Feature: The Ghost plugin on the dashboard
  Once the plugin is activated and installed, the sites folders offer the Ghost builder, the
  AI Agents folder lists the Ghost agents, and the Plugins page lists the plugin with its steps.

  Scenario: The plugin is listed on the Plugins page
    Given I am on "/settings/plugins"
     Then I should see "Ghost"
      And I should see "@webship.co/workspace-ghost"

  Scenario: A sites folder offers the Ghost builder
    Given I am on "/dev"
     Then "option[value='cmd-ghost-project.sh']" should be attached

  Scenario: The AI Agents folder lists the agents the plugin ships
    Given I am on "/ai-agents"
     Then I should see "ghost-site-builder"
      And I should see "ghost-tester"
