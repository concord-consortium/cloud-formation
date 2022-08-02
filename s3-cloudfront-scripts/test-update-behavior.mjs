// We use 'mjs' extension to run in ES6 mode which gives us top level await support

import AWS from 'aws-sdk';
import { updateDistributions } from './util/cloudfront-utils.mjs';

AWS.config.update({region: 'us-east-1'})
console.log(`AWS Version: ${AWS.VERSION}`)
console.log(`AWS Access Key: ${AWS.config.credentials.accessKeyId}`)
console.log(`AWS Region: ${AWS.config.region}`)

var cloudfront = new AWS.CloudFront({apiVersion: '2020-05-31'});

function modifyBehavior(distribution, behavior) {
  behavior.CachePolicyId = "a1cf85e6-b5ea-4ed9-80e7-1cf3cdc8ecaa";
  delete behavior.DefaultTTL;
  delete behavior.ForwardedValues;
  delete behavior.MaxTTL;
  delete behavior.MinTTL;
  return true;
}

function modifyOrigin(origin) {
  const customCorsOriginHeader = origin.CustomHeaders.Items
    .find(header => header.HeaderName === "Origin");
  if (customCorsOriginHeader) {
    console.log(`Origin already has custom Origin header of ${customCorsOriginHeader.HeaderValue}`);
    return false;
  } else {
    origin.CustomHeaders.Items.push({
      HeaderName: "Origin",
      HeaderValue: "https://concord.org"
    })
    origin.CustomHeaders.Quantity = origin.CustomHeaders.Items.length;
    return true;
  }
}

await updateDistributions(cloudfront, ["E3FXU5FXPVO7AK"], null, modifyOrigin);
