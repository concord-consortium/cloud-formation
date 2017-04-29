- automate the deployment of the nested-templates
- need to figure out how to notify the app when solr is restarted so we can automatically re-index it. Perhaps the best is if the app had an API to kick off a solr reindex (in the background), then there could be a startup script for the solr container which would hit this api after solr has started.

The yaml in lara-ecs is very redundant but I haven't found an easy way to improve that.
Some of it could be pulled out into a new template. But then passing the parameters to that template would probably require a double set of conditionals both in the main template and the sub-template. So this doesn't seem any better than what we currently have. Using a meta language to create the cloudformation template might be the only way to reduce the redundancy.
