- the learn-report site appears to not be sending the user to the correct target group

- need to figure out how to notify the app when solr is restarted so we can automatically re-index it. Perhaps the best is if the app had an API to kick off a solr reindex (in the background), then there could be a startup script for the solr container which would hit this api after solr has started.

- automate the deployment of the nested-templates

The yaml in lara-ecs is very redundant but I haven't found an easy way to improve that.
Some of it could be pulled out into a new template. But then passing the parameters to that template would probably require a double set of conditionals both in the main template and the sub-template. So this doesn't seem any better than what we currently have. Using a meta language to create the cloudformation template might be the only way to reduce the redundancy.

- It is possible to run migrations or solr reindex by using the RunTask action on the
  task definition. The command of the task definition can be overridden. That might be
  slightly less annoying that ssh'ing in.  It also means that we could have a utility
  folder that would send these common commands to ECS. It could be similar to capistrano.
  However it is certainly nice to use a web GUI.  Another optio is to make additional
  task definitions that are not attached to services, for each of these commands. Then a
  user can select the task definition and just run it. The issue with this is the
  repetitive environment that is needed for each. If we used a tool for generating
  the cloudformation template that repetition would not be as bad.

- the portal stack is getting large enough, that it might make sense to break it up.
  This way some pieces of it can be updated independently.  I'm not sure how practical
  that would be. For example the Solr parts could be totally separate. The tasks could
  also be updated separately. In many case two or more of the stacks would need to be to
  updated. If a DNS address was used the Solr piece could be independent.  If the tasks
  were split out then all of the stacks using those tasks would have to be updated.
