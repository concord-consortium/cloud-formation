This repo holds the CloudFormation stacks used for deployment and development of

1. LARA
2. Portal
3. Log Ingester
4. api.concord.org
5. Question Rater

[LARA Deployment](https://docs.google.com/document/d/1NS4MGch4cmwSFN7UJdaNFtBUqMMNe55R2fRuEHEhf0o/edit#heading=h.2f262hz7x02h)
(if you have access)

[Portal Deployment](https://docs.google.com/document/d/1dmAV4ojzwau2C-TANvoxw9jAnUN2F5FdOSSy6f42H84/edit#heading=h.2f262hz7x02h)

Running script to create an app-only Portal stack with parameters copied from another stack:

```bash
    cd scripts
    npm install
    cp create-config.sample.yml create-config.yml
    # modify create-config.yml to match what you want to do
    npm run create-stack
```

This script should work for other types of stacks, but it hasn't been tested.

See the file ./scripts/README.md for more details.

## CreatePaired QA servers (LARA / Portal)

See also the [Google Drive document](https://docs.google.com/document/d/1rAJrWy6cNHvo_x-c0vCAfNF2nu3BqtdFgrV8LLiJ8SU/edit#heading=h.pivpxvk0jh1l) for a verbose blow-by-blow account of how this was used to setup a staging environment in the past.

These instructions should help you deploy paired sets of LARA & Portal servers.
The examples assume the QA environment, but you can do this in staging as well.
Recent template changes should make this process easier.

Summary:

- Clone RDS instances of the production LARA and Portal databases using snapshots if you can.
- Use `create-stack` scripts to provision a Portal using configs and param overrides.
- Modify the Portal auth-client `authoring` configuration to fix authentication.
- Update URLS to shared resources on both servers using `lib/script/rewrite_lara_portal_resources.rb` from the LARA repo.

### Creating the stacks

1. Change into the `scripts` directory and install the dependencies: `cd scripts && npm install`
2. Create some configuration files. These config templates will setup your stacks for you. See the `README.md` file in the scripts directory for more info: `cp configs/create-config.sample.yml configs/create-my-project-config.yml`
3. Copy Parameters from production or staging stacks.
    1. Select your primary AWS account credentials to copy stack parameters for the production LARA and Portal instances you are working on. `export AWS_PROFILE=concord`
    2. Run the `create-stack` npm script to copy the stack parameters your want. `npm run create-stack`
4. Select the first menu item "Save stack params".  The script will show you a list of running stacks. Type-ahead search for the stack you want to copy into the QA environment.
5. Your parameters will be saved in the folder `stack-params`
6. Modify your `configs/create-my-project-config.yml file`
    1. Update the `OriginalStack` parameter to point to the stack-params file you just downloaded.
    2. Update any `ParameterModifications` you would like to override.
        1. Check or override these LARA params:
            1. `HostName`
            2. `DomainNameBase`
            3. `CloudWatchLogGroup`
            4. `DbHost`
            5. `DatabaseSecurityGroupId`
            6. `Environment`
            7. `QAPortalSecret`
            8. `QAPortalURL`
        2. Check or override these PORTAL params:
            1. `ShortName`
            2. `DomainName`
            3. `CloudWatchLogGroup`
            4. `SiteURL`
            5. `Environment`
            6. `DbHost`
            7. `DatabaseSecurityGroupId`
            8. `AuthoringSiteURL`
            9. `S3SecreteAccessKey`
            10. `S3AccessKeyId`
            11. `ReportDomainName`
            12. `LogStashDbHost`
            13. `ClusterStackName`
    3. See the `scripts/README.md` file for more info

7. Configure AWS command line tools. Set your `AWS_PROFILE` to the appropriate account (eg: `concord-qa`)
8. Run the `create-stack` npm script again.
9. Select `Create stack` from the script menu, selecting your newly modified configuration file (`create-my-project-config.yml`)
10. Monitor the creation of your stack using the AWS console.

### Configuring Paired Authentication

- Before creating the LARA instance, connect to the Portal you created.
- Find the AuthClient for `authoring` in the admin clients listing in the Portal, and edit it.
- Generate a new Secret.
- Update the `Allowed redirect URIs`  parameter to include the callback URL for your future LARA instance eg:
- `-   https://ngss-staging-lara.staging.concord.org/users/auth/cc_portal_qa_portal/callback`
- Set the Template parameters for the LARA instance:
  - `PortalClientID: 'authoring'`
  - `QAPortalSecret: <secret from Portal auth-clients>`
  - `QAPortalURL: <https url to the Portal>`

- If the `QAPortalSecret` and `QAPortalURL` parameters are set in the `create-config.yml` file, the `lara-ecs.yml` template will configure a new `CONCORD_CONFIGURED_PORTALS` auth provider.
- Check or set the value for the parameter `PortalClientID`
- Make sure `PortalClientID`, `QAPortalURL` and `QAPortalSecret` match an entry in the list of Auth Clients on the paired Portal.

### Converting Resource URLS in the newly created pair

Because the RDS servers were created from production, its important to rewrite resources in both the Portal and in LARA.

- Copy the script from the [lara git repo](https://github.com/concord-consortium/lara/blob/f33288cc3fba3ec32ccb7b90087d573e0abc8934/script/rewrite_lara_portal_resources.rb) in `lib/script/ rewrite_lara_portal_resources.rb` and open a consoles in both the LARA and Portal rails servers.
- In the Portal console run eg: `update_portal_lara_refs('authoring.concord.org', 'my-lara.concord-qa.org')`
- In Lara console run eg: `update_lara_portal_refs('learn.concord.org', 'my-portal.concord-qa.org')`

## api.concord.org

This domain is managed by the api.concord.org.yml CloudFormation template.  That template creates the domain within the AWS API Gateway service and adds a Route 53 recordset pointing to the CloudFront distribution automatically created as part of the API Gateway domain.

Other CloudFormation templates using Lambda functions can then route requests via api.concord.org by using a `AWS::ApiGateway::BasePathMapping` in the following form (taken frm log-ingester.yml):

```yaml
ApiGatewayMapping:
  Type: AWS::ApiGateway::BasePathMapping
  DependsOn:
    - ApiGateway
  Properties:
    BasePath: !Ref ApiGatewayBasePath
    DomainName: api.concord.org
    RestApiId: !Ref ApiGateway
    Stage: latest
```

where `ApiGatewayBasePath` is a CloudFormation parameter and `ApiGateway` is a `AWS::ApiGateway::RestApi`.  If, for example, `ApiGatewayBasePath` is `log-staging` and the endpoint url of the `latest` stage ApiGateway is `https://k254j5v1p0.execute-api.us-east-1.amazonaws.com/latest/` then after the gateway mapping completes `https://api.concord.org/log-staging/logs` will route to `https://k254j5v1p0.execute-api.us-east-1.amazonaws.com/log-staging/logs`.

## Log Ingester

The log-ingester.yml CloudFormation template creates the following resources (along with the needed roles)

1. An API Gateway
2. A Kinesis stream
3. A Lambda function
4. An RDS database

The API Gateway takes POST logging requests to /logs and, via template mapping, and sends a record to the Kinesis stream in the form of <current millisecond timestamp>;<POST body>.  The Kinesis stream automatically triggers the Lambda function which parses the record and then creates a canonical log record that is inserted into the RDS database into the logs table.

This ingester is meant to replace the Heroku based log manager.

If you do not import the existing log manager data from Heroku the ingester schema needs to be manually created by connecting to the RDS instance that is created and then running the following queries:

```sql
CREATE EXTENSION IF NOT EXISTS hstore;

CREATE TABLE logs (
    id integer NOT NULL,
    session character varying(255),
    username character varying(255),
    application character varying(255),
    activity character varying(255),
    event character varying(255),
    "time" timestamp without time zone,
    parameters hstore DEFAULT ''::hstore NOT NULL,
    extras hstore DEFAULT ''::hstore NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    event_value character varying(255),
    run_remote_endpoint character varying(255)
);

CREATE SEQUENCE logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY logs ALTER COLUMN id SET DEFAULT nextval('logs_id_seq'::regclass);
ALTER TABLE ONLY logs ADD CONSTRAINT logs_pkey PRIMARY KEY (id);
CREATE INDEX index_logs_on_activity ON logs USING btree (activity);
CREATE INDEX index_logs_on_application ON logs USING btree (application);
CREATE INDEX index_logs_on_event ON logs USING btree (event);
CREATE INDEX index_logs_on_run_remote_endpoint ON logs USING btree (run_remote_endpoint) WHERE (run_remote_endpoint IS NOT NULL);
CREATE INDEX index_logs_on_session ON logs USING btree (session);
CREATE INDEX index_logs_on_time ON logs USING btree ("time");
CREATE INDEX index_logs_on_username ON logs USING btree (username);
```

## Locally validating CloudFormation templates

You can locally validate the CloudFormation templates in two ways:

1. Use [cfn-lint](https://github.com/awslabs/cfn-python-lint)
   1. Run `pip install cfn-lint` to install it
   2. Run `cfn-lint <filename>` to lint the file specified
2. Use [aws cloudformation validate-template](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/validate-template.html)
   1. Install the [aws cli](https://aws.amazon.com/cli/)
   2. Run `aws cloudformation validate-template --template-body file://<filename>` to validate the file specified
