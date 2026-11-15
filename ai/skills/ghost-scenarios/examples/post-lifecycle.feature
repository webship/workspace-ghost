Feature: An editor writes a post and removes it again
  As an editor
  I want to write, publish, unpublish and delete a post
  So that the suite proves the editor works and leaves the site as it found it

  Scenario: The editor publishes a post, sees it on the site and deletes it
    Given I am logged in to the admin as "editor"
    And there is no post titled "A post written by a scenario"
    When I start a new post
    And I set the editor title to "A post written by a scenario"
    And I write "This post is written and removed by the suite." in the editor
    And I publish the post
    Then the publish confirmation should say "A post written by a scenario"
    When I close the publish confirmation
    Then the post "A post written by a scenario" should have the status "Published" in the list
    When I go to "/a-post-written-by-a-scenario/"
    Then the response status code should be 200
    And the page should be a post
    And I should see "This post is written and removed by the suite."
    When I open the editor of the post "A post written by a scenario"
    And I unpublish the post
    Then the editor status should be "Draft"
    When I delete the post from the editor
    Then I should not see the post "A post written by a scenario" in the list
