These instructions will add setup a new instance of LARA for demoing new features.
The URL will be of the form
http://[branch or tag name].lara.demo.concord.org

In Rancher
- open the 'demo' environment
- go to the 'lara' stack
- clone the 'master' service
- use the name of your branch or tag for the name of the service
- change the image to be the one built by docker hub for your branch or tag
   typically: concordconsortium/lara:[branch or tag name]
- change the DB_NAME environment variable to match the name of the service
- create the service
- clone the 'master-worker' service and change the DB_NAME and image name
- edit the load-balancer service
- add a new target to the load-balancer
- set the 'Request Host' to be [branch or tag name].lara.demo.concord.org
- set the target service to be the service you just setup
- go to the infrastructure view of the demo environment
- record the host IP address of the single host

In Route 53
- add a new recordset
- It should be an A record
- the name should be [branch or tag name].lara.demo.concord.org
- the IP should be the host IP you recorded from rancher

Creating a admin user:
- sign in using learn staging, this will make you a basic user
- go to rancher and open the console for the container running your image
- run `rails c`
- run `user = User.last; user.is_admin=true; user.save`

These directions assume that the database is automatically migrated when the service was created.
Currently this doesn't happen so after the service has been created:
- in rancher
- open the console
- run `rake db:migrate`
- after it is complete restart the container
- you might have to restart it twice due to some issue with unicorn

