// We use 'mjs' extension to run in ES6 mode which gives us top level await support

import AWS from 'aws-sdk';
import CSVWriter from 'csv-writer';

const region = 'us-east-1';
AWS.config.update({region})
console.log(`AWS Version: ${AWS.VERSION}`)
console.log(`AWS Access Key: ${AWS.config.credentials.accessKeyId}`)
console.log(`AWS Region: ${AWS.config.region}`)

const s3 = new AWS.S3({apiVersion: '2006-03-01'});
let params;

const buckets = [];

params = {};
let data = await s3.listBuckets(params).promise();

for (const bucket of data.Buckets) {
  console.log(bucket.Name);

  const bucketParam = {
    Bucket: bucket.Name
  };

  const ignoreError = () => {};

  // TODO: add getPublicAccessBlock to see if this bucket has public access blocked

  const [
    cors,
    policy,
    website,
    location,
    tagging
  ] = await Promise.all([
    s3.getBucketCors(bucketParam).promise().catch(ignoreError),
    s3.getBucketPolicy(bucketParam).promise().catch(ignoreError),
    s3.getBucketWebsite(bucketParam).promise().catch(ignoreError),
    s3.getBucketLocation(bucketParam).promise().catch(ignoreError),
    s3.getBucketTagging(bucketParam).promise().catch(ignoreError)
  ]);

  const corsFields = {};
  // Might need a default of null for each field here
  if (cors) {
    corsFields.Cors = JSON.stringify(cors);
    if (cors.CORSRules && cors.CORSRules[0]) {
      const rule = cors.CORSRules[0];
      corsFields.AllowedHeaders = JSON.stringify(rule.AllowedHeaders);
      corsFields.AllowedMethods = JSON.stringify(rule.AllowedMethods);
      corsFields.AllowedOrigins = JSON.stringify(rule.AllowedOrigins);
      corsFields.ExposeHeaders = JSON.stringify(rule.ExposeHeaders);
      corsFields.MaxAgeSeconds = rule.MaxAgeSeconds;
    }
  }

  let bucketRegion = null;
  if (location) {
    bucketRegion = location.LocationConstraint ? location.LocationConstraint : "us-east-1";
  }

  let tags = null;
  if (tagging) {
    tags = {};
    tagging.TagSet.forEach(entry => {
      tags[entry.Key] = entry.Value;
    });
  }

  // The website endpoint can be either:
  // bucket-name.s3-website-region.amazonaws.com
  // bucket-name.s3-website.region.amazonaws.com
  buckets.push({
    ...bucket,
    BucketType: tags.BucketType,
    Notes: tags.Notes,
    ...corsFields,
    Website: website ? `http://${bucket.Name}.s3-website.${bucketRegion}.amazonaws.com` : null,
    Region: bucketRegion,
    Tags: tags ? JSON.stringify(tags) : null,
    Policy: policy ? policy.Policy : null
  });
}

const createCsvWriter = CSVWriter.createObjectCsvWriter;
const csvBucketWriter = createCsvWriter({
    path: 'buckets.csv',
    header: [
        {id: 'Name', title: 'Name'},
        {id: 'BucketType', title: 'BucketType'},
        {id: 'Notes', title: 'Notes'},
        {id: 'AllowedHeaders', title: 'AllowedHeaders'},
        {id: 'AllowedMethods', title: 'AllowedMethods'},
        {id: 'AllowedOrigins', title: 'AllowedOrigins'},
        {id: 'ExposeHeaders', title: 'ExposeHeaders'},
        {id: 'MaxAgeSeconds', title: 'MaxAgeSeconds'},
        {id: 'CreationDate', title: 'Created'},
        {id: 'Website', title: 'Website'},
        {id: 'Region', title: 'Region'},
        {id: 'Tags', title: 'Tags'},
        {id: 'Cors', title: "Raw CORS Config"},
        {id: 'Policy', title: "Policy"},
    ]
});

await csvBucketWriter.writeRecords(buckets);
console.log('...Done');
