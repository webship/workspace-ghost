Feature: The site answers and its accounts work
  As the owner of the site
  I want the front page, the sign in screen and each default account to work
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup as a starting point: it is yours to change.
  # The accounts are the default ones (cmd-tools-add-users.sh); a scenario signs in by a handle of
  # the users registry in cucumber.js, so no password is written here.

  @critical
  Scenario: The front page is served
    Given I am an anonymous user
    When I go to the homepage
    Then the response status code should be 200
    And the page should be the home page

  @critical
  Scenario: The sign in screen is served to a visitor who asks for the admin
    Given I am an anonymous user
    Then the admin screen "Posts" should not be available
    And I should be on the admin screen "sign in"
    And I should not be logged in to the admin

  Scenario Outline: Each default account signs in and has its role
    Given I am logged in to the admin as "<handle>"
    Then I should be logged in to the admin as "<handle>"
    And the user menu should show "<handle>@example.com"
    When I log in to the admin as "administrator"
    Then I should see the staff user "<handle>" with the role "<role>"

    Examples:
      | handle        | role          |
      | administrator | Administrator |
      | editor        | Editor        |
      | author        | Author        |
      | contributor   | Contributor   |

  Scenario: An account is refused a screen its role may not open
    Given I am logged in to the admin as "contributor"
    Then the admin screen "Settings" should not be available
    And the admin screen "Members" should not be available

  Scenario: An anonymous visitor has no session
    Given I am an anonymous user
    When I go to the homepage
    Then I should not be logged in to the admin
    And I should see a subscribe button
