These scripts were used to add or update the CORS settings on many buckets and distributions. They were designed to be reusable, but if you need to do something similar it might be better to just grab bits and pieces of them and make new scripts.

To run the scripts:

1. you  need local AWS credentials:
https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html
2. run `npm install` in this folder
3. run a script with `npm run [script-name]`


## bucket-list

Generate a `buckets.csv` with information about the buckets in the current account. It has the following columns:
- **Name:** name of the bucket
- **BucketType:** value of the BucketType tag on bucket, this is a custom tag invented to help with maintaining buckets
- **Notes:** value of the Notes tag on the bucket
- **AllowedHeaders:** value from the 1st CORS config on the bucket
- **AllowedMethods:** value from the 1st CORS config on the bucket
- **AllowedOrigins:** value from the 1st CORS config on the bucket
- **ExposeHeaders:** value from the 1st CORS config on the bucket
- **MaxAgeSeconds:** value from the 1st CORS config on the bucket
- **CreationDate:** date the bucket was created
- **Website:** if the bucket has a website endpoint this will be set to the endpoint, otherwise it will null
- **Region:** region of the bucket
- **Tags:** All of the tags on the bucket
- **Cors:** the full CORS config of the bucket
- **Policy:** the full Policy of the bucket

## bucket-update-cors

For every bucket that has a tag BucketType with a value 'public', set its CORS to be a standard config. See the `CORSConfiguration` in the `bucket-update-cors.mjs` file.

## bucket-update-tags

Load in a `bucket-tags.tsv` file which has the format:
| Name         | TagKey1     | TagKey2     | ... | TagKeyN     |
| ----         | -------     | -------     | --- | -------     |
| bucket1-name | tag1-value  | tag2-value  | ... | tagN-value  |
| bucket2-name | tag1-value  | tag2-value  | ... | tagN-value  |
| ...          | ...         | ...         | ... | ...         |
| bucketN-name | tag1-value  | tag2-value  | ... | tagN-value  |

And apply these tags to the buckets. Tab separated format was used because that is how Google Sheets provides the data when you copy a range of cells and paste them into a text editor.

## cf-behavior-list

Generate a `behaviors.csv` with information about the behaviors of all of the CloudFront distributions in the account.

- **Id:** id of the CloudFront distribution
- **DomainName:** domain name of the CloudFront distribution
- **Aliases:** aliases (CNAMEs) of the CloudFront distribution
- **PathPattern:** path pattern of the behavior, if this is the default behavior it will be blank
- **OriginDomainName:** domain name of the origin associated with the behavior
- **OriginPath:** path of the origin associated with the behavior
- **BucketName:** name of the bucket, this is computed from the domain of the origin, blank if it isn't a bucket
- **BucketType:** BucketType tag of the bucket. blank if the behavior isn't associated with a bucket, or `error fetching` if an error happened when requesting the bucket tags
- **ViewerProtocolPolicy:** how the behavior handles http requests
- **AllowedMethods:** the http methods allowed by the behavior
- **CachePolicyName:** the name of the cache policy associated with the behavior, if set the WhiteListedHeaders should be blank
- **WhitelistedHeaders:** headers that should be used as keys in the cache and also forwarded to the origin of the behavior. The cache policy replaces this field.
- **CachePolicyId:** the id of the cache policy, this isn't visible in the AWS Console, but when viewing a cache policy the URL includes this Id.
- **OriginRequestPolicyId:** the id of the origin request policy. We aren't using these.

## cf-behavior-list (update enabled)

If you uncomment the last line in the `cf-behavior-list.mjs` file then the script will also update the distributions. This was used to update all behaviors using public S3 buckets so they would use the S3-CORS cache policy.

The update script part of the script looks for distributions meeting the following criteria. It has to have at least one behavior that has all of the following properties:
- has a bucket origin (see the BucketName column above)
- the bucket origin has a BucketType tag of 'public' or 'public-custom-cors'
- the behavior doesn't already have a CachePolicyId of one of the two S3-CORS cache policies

Each matching distribution has each of behavior that meets the criteria above updated to usse the S3-CORS cache policy. Cache Policies can only be associated with 100 distributions. So the script works with both the S3-CORS and S3-CORS-1 policies.

The update code is written to be modular so you can replace the `modifyBehavior` function to look for different conditions and/or update the behavior differently. But note that that thre is a separate filter to figure out which distributions need updating, so that filter needs to be updated too.

It is useful to test these modification with a single distribution before applying the changes to all distributions. See the test-udpate-behavior for that.

## test-update-behavior

Update all behaviors of a single hard coded distribution with a CachePolicyId.  This script can be used to test out other types of behavior modifications on a single distribution at a time.
