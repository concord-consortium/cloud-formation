// We use 'mjs' extension to run in ES6 mode which gives us top level await support

import AWS from 'aws-sdk';
import CSVWriter from 'csv-writer';
import fs from 'fs';
import path from 'path';

const region = 'us-east-1';
AWS.config.update({region})
console.log(`AWS Version: ${AWS.VERSION}`)
console.log(`AWS Access Key: ${AWS.config.credentials.accessKeyId}`)
console.log(`AWS Region: ${AWS.config.region}`)

const s3 = new AWS.S3({apiVersion: '2006-03-01'});
let params;

const bucket = "sensorconnector-s3.concord.org"

const bucketParam = {
  Bucket: bucket
};

const currentFileUrl = new URL(import.meta.url);
const __filename = currentFileUrl.pathname;

const CORSConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: [
        "*"
      ],
      AllowedMethods: [
        "GET",
        "HEAD"
      ],
      AllowedOrigins: [
        "*"
      ],
      ExposeHeaders: [
        "ETag",
        "Content-Length"
      ],
      MaxAgeSeconds: 3000
    }
  ]
}

const buckets = [];

params = {};
let data = await s3.listBuckets(params).promise();

for (const bucket of data.Buckets) {
  const bucketParam = {
    Bucket: bucket.Name
  };

  const ignoreError = () => {};

  const tagging = await s3.getBucketTagging(bucketParam).promise().catch(ignoreError);

  if (!tagging) {
    continue;
  }

  if (tagging.TagSet.find(tag => tag.Key === "BucketType" && tag.Value === "public")) {
    console.log(`${bucket.Name} - updating cors`);
    await s3.putBucketCors({...bucketParam, CORSConfiguration}).promise();    
    console.log("  updated.");
  }
}
