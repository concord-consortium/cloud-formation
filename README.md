This repo holds the CloudFormation stacks used for LARA deployment and development.

[LARA Deployment](https://docs.google.com/document/d/1NS4MGch4cmwSFN7UJdaNFtBUqMMNe55R2fRuEHEhf0o/edit#heading=h.2f262hz7x02h)
(if you have access)

[Portal Deployment](https://docs.google.com/document/d/1dmAV4ojzwau2C-TANvoxw9jAnUN2F5FdOSSy6f42H84/edit#heading=h.2f262hz7x02h)


Running script to create an app-only portal stack with parameters copied from another stack:

    cd scripts
    npm install
    cp create-config.sample.yml create-config.yml
    # modify create-config.yml to match what you want to do
    npm run create-stack

This script should work for other types of stacks, but it hasn't been tested.
