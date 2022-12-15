The create-stack.js script is a menu driven script to help manage creating new
CloudFormation stacks. It supports two main actions:

## Read and save stack parameters
If you select `Save stack params` as the action, you will be able to select
a stack running under your current aws-profile, as specified in the `AWS_PROFILE`
environment variable.

The script will then read in the Parameters for that stack, and put them into a yaml file located in the `stack-params` directory.

## Create a new running stack from a configuration file
If you choose the `Create stack` action, you will be shown a list of config
files from the `configs` directory. The script will fail if you have no
configurations in this folder.

## Config File format
Files in the `configs` directory should specify the following parameters:
* `Name`
* `Template` -- the name of the CloudFormation template yaml file to use
* optionally one of the following source Param types:
    * `StackParams` — The file under `stack-params` to use for default params
    * `OriginalStack` — The name of a running stack to copy params from
    * If no params are specified, you will be prompted to choose an existing
    parameter set from `stack-params/*.yml`
* `ParameterModifications` — Values to replace from the stack-params.

## .gitignore
Because you will be creating config files that might have passwords in them,
git will ignore `.yml` files in the `configs` and `stack-params` folders. Sample
files have been renamed `.sample-yml` which might break editor configurations.


reads a `create-config.yml` file and then duplicates
an "OriginalStack" modifying parameters declared in the `create-config.yml`

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
