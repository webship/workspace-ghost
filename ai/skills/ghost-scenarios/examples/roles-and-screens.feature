Feature: Each staff role reaches the screens it may use
  As the owner of the site
  I want every staff role to open its own screens and to be refused the others
  So that a change of what a role may do is caught by the suite

  # The accounts are the default ones; a scenario signs in by a handle of the users registry.

  Scenario: An editor opens the posts and the tags, and has no Members screen
    Given I am logged in to the admin as "editor"
    When I go to the admin screen "Posts"
    Then I should be on the admin screen "Posts"
    And I should see "Tags" in the admin menu
    And I should not see "Members" in the admin menu
    And the admin screen "Members" should not be available

  Scenario: An author has the posts and nothing that manages the site
    Given I am logged in to the admin as "author"
    Then I should see "Posts" in the admin menu
    And I should not see "Tags" in the admin menu
    And the admin screen "Tags" should not be available
    And the admin screen "Staff" should not be available

  Scenario: A contributor is refused the settings
    Given I am logged in to the admin as "contributor"
    Then the admin screen "Settings" should not be available

  Scenario: An administrator sees each staff account with its role
    Given I am logged in to the admin as "administrator"
    Then I should see the staff user "editor" with the role "Editor"
    And I should see the staff user "author" with the role "Author"
    And I should see the staff user "contributor" with the role "Contributor"
