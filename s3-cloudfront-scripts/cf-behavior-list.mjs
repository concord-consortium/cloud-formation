// We use 'mjs' extension to run in ES6 mode which gives us top level await support

import AWS from 'aws-sdk';
import CSVWriter from 'csv-writer';
import { mapFromTagging } from './util/s3-utils.mjs';
import { updateDistributions } from './util/cloudfront-utils.mjs';

AWS.config.update({region: 'us-east-1'})
console.log(`AWS Version: ${AWS.VERSION}`)
console.log(`AWS Access Key: ${AWS.config.credentials.accessKeyId}`)
console.log(`AWS Region: ${AWS.config.region}`)

const createCsvWriter = CSVWriter.createObjectCsvWriter;

// The two types of origin domains are the main S3 endpoint and
// the website endpoint. Here are some examples
// interactions-resources.s3.amazonaws.com
// learn-resources.s3-website-us-east-1.amazonaws.com
// lab-framework.concord.org.s3-website-us-east-1.amazonaws.com
const bucketOriginPattern = /(.*)\.s3[^.]*\.amazonaws\.com/;

const bucketToBehavior = {};
const cachePolicyToBehavior = {};

function bucketName(originDomainName) {
  const found = originDomainName.match(bucketOriginPattern);
  if (found) {
    return found[1];
  }
  return '';
}

function makeBehaviorRecord(distribution, behavior) {
  const origin = distribution.Origins.Items.find((origin) => origin.Id === behavior.TargetOriginId);
  const bucket = bucketName(origin.DomainName);

  const OriginCustomHeaders = origin.CustomHeaders.Items
    .map(header => `${header.HeaderName}: ${header.HeaderValue}`)
    .join(', ');

  const behaviorRecord = {
    Id: distribution.Id,
    DomainName: distribution.DomainName,
    Aliases: distribution.Aliases.Items.join(', '),
    ...behavior,
    WhitelistedHeaders: behavior.ForwardedValues?.Headers?.Items.join(', '),
    AllowedMethods: behavior.AllowedMethods.Items.join(', '),
    OriginDomainName: origin.DomainName,
    OriginPath: origin.OriginPath,
    OriginCustomHeaders,
    BucketName: bucket,
    RawBehavior: JSON.stringify(behavior, null, 2),
    RawOrigin: JSON.stringify(origin, null, 2)
  }

  if (bucket) {
    if (bucketToBehavior[bucket]) {
      bucketToBehavior[bucket].push(behaviorRecord);
    } else {
      bucketToBehavior[bucket] = [behaviorRecord];
    }
  }

  const cachePolicyId = behavior.CachePolicyId;
  if (cachePolicyId) {
    if (cachePolicyToBehavior[cachePolicyId]) {
      cachePolicyToBehavior[cachePolicyId].push(behaviorRecord);
    } else {
      cachePolicyToBehavior[cachePolicyId] = [behaviorRecord];
    }
  }

  return behaviorRecord;
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
    console.log(`received: ${batch.DistributionList.Quantity} distributions`);

    behaviors.push(makeBehaviorRecord(distribution, distribution.DefaultCacheBehavior));

    for(const cacheBehavior of distribution.CacheBehaviors.Items) {
      behaviors.push(makeBehaviorRecord(distribution, cacheBehavior));
    }
  }
}

// Look up BucketType from each bucket
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
const bucketTags = {};
for (const bucket of Object.keys(bucketToBehavior)) {
  console.log(`${bucket} - loading tags`);
  // fetch the tags of the bucket
  // add the BucketType to each of the behaviors
  try {
    const tagging = await s3.getBucketTagging({Bucket: bucket}).promise();
    const tags = mapFromTagging(tagging);
    for (const behavior of bucketToBehavior[bucket]) {
      behavior.BucketType = tags.BucketType;
    }
    bucketTags[bucket] = tags;
  } catch (error) {
    console.log(`error fetching tags from ${bucket}`, error);
    for (const behavior of bucketToBehavior[bucket]) {
      behavior.BucketType = "error fetching";
    }
  }
}

// Look up CachePolicy name
for (const cachePolicyId of Object.keys(cachePolicyToBehavior)) {
  console.log(`${cachePolicyId} - loading cache policy`);
  try {
    const policy = await cloudfront.getCachePolicy({Id: cachePolicyId}).promise();
    for (const behavior of cachePolicyToBehavior[cachePolicyId]) {
      behavior.CachePolicyName = policy.CachePolicyConfig.Name;
    }
  } catch (error) {
    console.log(`error fetching cache policy: ${cachePolicyId}`);
    for (const behavior of cachePolicyToBehavior[cachePolicyId]) {
      behavior.CachePolicyName = "error fetching";
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
        {id: 'OriginCustomHeaders', title: 'OriginCustomHeaders'},
        {id: 'BucketName', title: 'BucketName'},
        {id: 'BucketType', title: 'BucketType'},
        {id: 'ViewerProtocolPolicy', title: 'ViewerProtocolPolicy'},
        {id: 'AllowedMethods', title: 'AllowedMethods'},
        {id: 'CachePolicyName', title: 'CachePolicyName'},
        {id: 'WhitelistedHeaders', title: 'WhitelistedHeaders'},
        {id: 'CachePolicyId', title: 'CachePolicyId'},
        {id: 'OriginRequestPolicyId', title: 'OriginRequestPolicyId'},
        // {id: 'RawOrigin', title: 'RawOrigin'},
        // {id: 'RawBehavior', title: 'RawBehavior'},
    ]
});

await csvBehaviorWriter.writeRecords(behaviors);

function shouldUpdateBasedOnBucketType(bucketType) {
  return bucketType === "public" || bucketType === "public-custom-cors";
}

const s3Cors1PolicyId = "a1cf85e6-b5ea-4ed9-80e7-1cf3cdc8ecaa";
const s3CorsPolicyId = "d41b1d60-f629-4499-93ba-a45153f58bbc";

function modifyBehavior(distribution, behavior) {
  const origin = distribution.Origins.Items.find((origin) => origin.Id === behavior.TargetOriginId);
  const bucket = bucketName(origin.DomainName);
  const bucketType = bucket && bucketTags[bucket] && bucketTags[bucket].BucketType;
  if (behavior.CachePolicyId !== s3CorsPolicyId &&
      behavior.CachePolicyId !== s3Cors1PolicyId &&
      shouldUpdateBasedOnBucketType(bucketType)) {
    behavior.CachePolicyId = s3CorsPolicyId;
    delete behavior.DefaultTTL;
    delete behavior.ForwardedValues;
    delete behavior.MaxTTL;
    delete behavior.MinTTL;
    return true;
  } else {
    return false;
  }
}

//----------
// Update distributions that need have behaviors with the CORS cache
// policy
// Uncomment this if you want to set the S3-CORS policy on public and public-custom-cors behaviors
//----------
// const behaviorRecordsToUpdate = behaviors.filter(behaviorRecord => {
//   return behaviorRecord.CachePolicyId !== s3CorsPolicyId &&
//     behaviorRecord.CachePolicyId !== s3Cors1PolicyId &&
//     shouldUpdateBasedOnBucketType(behaviorRecord.BucketType)
// });
// const distributionsToUpdate = new Set(behaviorRecordsToUpdate.map(behavior => behavior.Id));

// await updateDistributions(cloudfront, distributionsToUpdate, modifyBehavior, null);

//----------
// Update distributions that have bucket origins with a custom header
// called `Origin` this is needed to prevent caching of non cors 
// headers by browsers
//----------
// const behaviorRecordsToUpdate = behaviors.filter(behaviorRecord => {  
//   return !behaviorRecord.OriginCustomHeaders.match(/Origin:/) &&
//     shouldUpdateBasedOnBucketType(behaviorRecord.BucketType)
// });
// const distributionsToUpdate = new Set(behaviorRecordsToUpdate.map(behavior => behavior.Id));

// function modifyOrigin(origin) {
//   const bucket = bucketName(origin.DomainName);
//   const bucketType = bucket && bucketTags[bucket] && bucketTags[bucket].BucketType;
//   if (!shouldUpdateBasedOnBucketType(bucketType)) {
//     console.log("  skipping non public bucket origin");
//     return false;
//   }

//   const customCorsOriginHeader = origin.CustomHeaders.Items
//     .find(header => header.HeaderName === "Origin");
//   if (customCorsOriginHeader) {
//     console.log(`  Origin already has custom Origin header of ${customCorsOriginHeader.HeaderValue}`);
//     return false;
//   } 

//   origin.CustomHeaders.Items.push({
//     HeaderName: "Origin",
//     HeaderValue: "https://concord.org"
//   })
//   origin.CustomHeaders.Quantity = origin.CustomHeaders.Items.length;
//   return true;
// }

// await updateDistributions(cloudfront, distributionsToUpdate, null, modifyOrigin);
