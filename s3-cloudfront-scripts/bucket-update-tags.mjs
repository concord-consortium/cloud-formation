// We use 'mjs' extension to run in ES6 mode which gives us top level await support

import AWS from 'aws-sdk';
import CSVWriter from 'csv-writer';
import fs from 'fs';

const region = 'us-east-1';
AWS.config.update({region})
console.log(`AWS Version: ${AWS.VERSION}`)
console.log(`AWS Access Key: ${AWS.config.credentials.accessKeyId}`)
console.log(`AWS Region: ${AWS.config.region}`)

const s3 = new AWS.S3({apiVersion: '2006-03-01'});
let params;

function addOrUpdateTag(tagSet, key, value) {
  for (const tag of tagSet) {
    if (tag.Key === key) {
      tag.Value = value;
      return;
    }
  }

  tagSet.push({Key: key, Value: value});
}

var tagFile = fs.readFileSync("bucket-tags.tsv", "utf8");

const lines = tagFile.trim().split("\n");
const headerLine = lines.shift();
const [nameHeader, ...tagKeys] = headerLine.split("\t");
console.log(tagKeys);
for (const line of lines) {
  const [bucket, ...tagValues] = line.split("\t");
  console.log(bucket);

  const bucketParam = {
    Bucket: bucket
  };

  let tagging = {TagSet: []};
  try {
    tagging = await s3.getBucketTagging(bucketParam).promise();
  } catch (error) {
    // No tags on the bucket yet
  }

  for (let i=0; i<tagKeys.length; i++) {
    addOrUpdateTag(tagging.TagSet, tagKeys[i], tagValues[i]);
  }

  try {
    await s3.putBucketTagging({...bucketParam, Tagging: tagging}).promise();
    console.log("   updated tags");
  } catch (error) {
    console.log(`error putting tagging on: ${bucket}`, error);
  }
}
