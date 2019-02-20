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

## Locally validating CloudFormation templates

You can locally validate the CloudFormation templates in two ways:

1. Use [cfn-lint](https://github.com/awslabs/cfn-python-lint)
   1. Run `pip install cfn-lint` to install it
   2. Run `cfn-lint <filename>` to lint the file specified
2. Use [aws cloudformation validate-template](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/validate-template.html)
   1. Install the [aws cli](https://aws.amazon.com/cli/)
   2. Run `aws cloudformation validate-template --template-body file://<filename>` to validate the file specified
