These templates need to be copied up to an S3 bucket, then they can be referenced from
other templates using a form like:

    Resources:
      LaraWebService:
        Type: AWS::CloudFormation::Stack
        Properties:
          TemplateURL: https://s3.amazonaws.com/concord-devops/cloud-formation/ecs-web-service.yml
          Parameters:
            LoadBalancerIdleTimeout: '180'
            HealthCheckIntervalSeconds: '30'
            HealthyThresholdCount: '2'
            UnhealthyThresholdCount: '3'
            HealthCheckTimeoutSeconds: '5'
            DeregistrationDelay: '300'
            HTTPSCertificateArn: !FindInMap [SSLCertificateMap, !Ref 'SSLCertificateName', Id]
            DomainName: !Ref 'DomainName'
            TaskDefinition: !Ref 'LaraWebTaskDefinition'
            DesiredTaskCount: '1'
            ContainerName: LaraContainer
            ClusterName: { 'Fn::ImportValue': !Sub '${ClusterStackName}-ClusterName' }
            ClusterSecurityGroupId: { 'Fn::ImportValue': !Sub '${ClusterStackName}-ClusterSecurityGroupId' }
