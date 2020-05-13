The create-stack.js script reads a create-config.yml file and then duplicates
an "OriginalStack" modifying parameters declared in the create-config.yml

In the case of the Portal and LARA these duplicate stacks do not have their
own database unless you override the database parameters. Without their own
database the copies are still useful to demonstrate new features that don't
require migrations.

## AWS Credentials

To run with concordqa, add a concord-qa profile to your credentials file

Then set the environment variable

    AWS_PROFILE=concord-qa

More info here https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html

## Extra Steps for LARA

In order for users to log in to the new LARA instance from learn.staging,
you need to add the redirect url for this new LARA instance to the Auth Client
in learn staging. This is the link to the auth client used by the lara-qa
stack:

https://learn.staging.concord.org/admin/clients/2/edit
