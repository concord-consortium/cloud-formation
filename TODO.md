- conditionalize the http support in the ecs-web-service nested template.
- automate the deployment of the nested-templates

The yaml in lara-ecs is very redundant but I haven't found an easy way to improve that.
Some of it could be pulled out into a new template. But then passing the parameters to that template would probably require a double set of conditionals both in the main template and the sub-template. So this doesn't seem any better than what we currently have. Using a meta language to create the cloudformation template might be the only way to reduce the redundancy.
