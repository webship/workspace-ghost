Feature: A visitor reads the site
  As the owner of the site
  I want the home page, the first post, the first page and the tag archive to be served
  So that a theme or a setting that breaks the front end is caught by the suite

  # The titles are the ones a site has right after it is built: change them to the content of the site.

  Scenario: The home page lists the posts and the navigation
    Given I am an anonymous user
    When I go to the homepage
    Then the page should be the home page
    And I should see the post "Coming soon" in the post feed
    And I should see "Home" in the site navigation
    And I should see "About" in the site navigation
    And I should see a subscribe button
    And the archive should be on page 1

  Scenario: A page and a tag archive have their own kind of page
    Given I am an anonymous user
    When I go to "/about/"
    Then the page should be a page
    And the page should not be a post
    When I go to "/tag/news/"
    Then the page should be the tag archive of "news"
    And I should see the post "Coming soon" in the post feed

  Scenario: The search of the site finds a post
    Given I am an anonymous user
    When I go to the homepage
    And I open the site search
    And I search the site for "Coming"
    Then I should see the site search result "Coming soon"
