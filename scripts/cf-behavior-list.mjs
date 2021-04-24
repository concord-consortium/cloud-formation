// We use 'mjs' extension to run in ES6 mode which gives us top level await support

import AWS from 'aws-sdk';
import CSVWriter from 'csv-writer';

AWS.config.update({region: 'us-east-1'})
console.log(`AWS Version: ${AWS.VERSION}`)
console.log(`AWS Access Key: ${AWS.config.credentials.accessKeyId}`)
console.log(`AWS Region: ${AWS.config.region}`)

const createCsvWriter = CSVWriter.createObjectCsvWriter;

// The two types of origina domains are the main S3 endpoint and
// the website endpoint. Here are some examples
// interactions-resources.s3.amazonaws.com
// learn-resources.s3-website-us-east-1.amazonaws.com
// lab-framework.concord.org.s3-website-us-east-1.amazonaws.com
const bucketOriginPattern = /(.*)\.s3[^.]*\.amazonaws\.com/;

function bucketName(originDomainName) {
  const found = originDomainName.match(bucketOriginPattern);
  if (found) {
    return found[1];
  }
  return '';
}

function makeBehaviorRecord(distribution, behavior) {
  const origin = distribution.Origins.Items.find((origin) => origin.Id === behavior.TargetOriginId);


  return {
    Id: distribution.Id,
    DomainName: distribution.DomainName,
    Aliases: distribution.Aliases.Items.join(', '),
    ...behavior,
    WhitelistedHeaders: behavior.ForwardedValues?.Headers?.Items.join(', '),
    AllowedMethods: behavior.AllowedMethods.Items.join(', '),
    OriginDomainName: origin.DomainName,
    OriginPath: origin.OriginPath,
    BucketName: bucketName(origin.DomainName)
  };
}

var cloudfront = new AWS.CloudFront({apiVersion: '2020-05-31'});
const behaviors = [];
let marker = null;
let finished = false;
while(!finished) {
  const batchParams = {
    MaxItems: "30"
  };
  if(marker){
    batchParams.Marker = marker;
  }
  const batch = await cloudfront.listDistributions(batchParams).promise();
  marker = batch.DistributionList.NextMarker;
  finished = !batch.DistributionList.IsTruncated;
  for(const distribution of batch.DistributionList.Items) {
    console.log(`recieved: ${batch.DistributionList.Quantity} distributions`);

    behaviors.push(
      makeBehaviorRecord(distribution, distribution.DefaultCacheBehavior));

    for(const cacheBehavior of distribution.CacheBehaviors.Items) {
      behaviors.push(
        makeBehaviorRecord(distribution, cacheBehavior));
    }
  }
}

const csvBehaviorWriter = createCsvWriter({
    path: 'behaviors.csv',
    header: [
        {id: 'Id', title: 'Id'},
        {id: 'DomainName', title: 'DomainName'},
        {id: 'Aliases', title: 'Aliases'},
        {id: 'PathPattern', title: 'PathPattern'},
        {id: 'OriginDomainName', title: 'OriginDomainName'},
        {id: 'OriginPath', title: 'OriginPath'},
        {id: 'BucketName', title: 'BucketName'},
        {id: 'ViewerProtocolPolicy', title: 'ViewerProtocolPolicy'},
        {id: 'AllowedMethods', title: 'AllowedMethods'},
        {id: 'WhitelistedHeaders', title: 'WhitelistedHeaders'},
        {id: 'CachePolicyId', title: 'CachePolicyId'},
        {id: 'OriginRequestPolicyId', title: 'OriginRequestPolicyId'}
    ]
});

await csvBehaviorWriter.writeRecords(behaviors);
