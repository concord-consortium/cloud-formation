This repo holds the CloudFormation stacks used for deployment and development of

1. LARA
2. Portal
3. Log Ingester
4. api.concord.org
5. Question Rater

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

See the file ./scripts/README.md for more details.

## Paired QA servers (Lara / Portal)
2021-01-21: We want to be able tp deploy paired sets of Lara & Portal to the QA environment.
Recent template changes should make this easier.

1. Change into the `scripts` directory and install the dependencies: `cd scripts && npm install`
2. Create some configuration files. These config templates will setup your stacks for you. See the `README.md` file in the scripts directory for more info: `cp configs/create-config.sample.yml configs/create-my-project-config.yml`
3. Copy Parameters from production or staging stacks.
	1. Select your primary AWS account credentials to copy stack parameters for the production Lara and Portal instances you are working on. `export AWS_PROFILE=concord-qa`
	2. Run the `create-stack` npm script to copy the stack paraemters your want. `npm run create-stack`
	3. Select the first menu item "Save stack params".  The script will show you a list of running stacks. Type-ahead search for the stack you want to copy into the QA environment.
	4. Your parameters will be saved in the folder `stack-params`
	5. Modify your `configs/create-my-project-config.yml file`
		1. Update the `OriginalStack` parameter to point to the stack-params file you just downloaded.
		2. Update any `ParameterModifications` you would like to ovveride. You will especially want to look at the domainName
		3. See the `scripts/README.md` file for more info
	6. Configure AWS command line tools. Set your `AWS_PROFILE` to the `concord-qa` account.
	7.  Run the `create-stack` npm script again.
	8.  Select `Create stack` from the script menu, selecting your newly modified configuration file (`create-my-project-config.yml`)
	9.  Monitor the creation of your stack using the AWS console in the ConcordQA environment.


### Parameters for QA Paired Authentication:

* If the `QAPortalSecret` and `QAPortalURL` parameters are set in the `create-config.yml` file, the `lara-ecs.yml` template will configure a new `CONCORD_CONFIGURED_PORTALS` auth provider.
* Check or set the value for the parameter `PortalClientID`
* Make sure `PortalClientID`, `QAPortalURL` and `QAPortalSecret` match an entry in the list of Auth Clients on the paired Portal.

## api.concord.org

This domain is managed by the api.concord.org.yml CloudFormation template.  That template creates the domain within the AWS API Gateway service and adds a Route 53 recordset pointing to the CloudFront distribution automatically created as part of the API Gateway domain.

Other CloudFormation templates using Lambda functions can then route requests via api.concord.org by using a `AWS::ApiGateway::BasePathMapping` in the following form (taken frm log-ingester.yml):

```
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

```
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
