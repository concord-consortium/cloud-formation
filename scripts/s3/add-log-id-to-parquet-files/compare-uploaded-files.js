import { S3Client, ListObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs"
import path from "path"
import mkdirpsync from "mkdirpsync"

const PARQUET_SUFFIX = ".parquet";

const TEMP_INPUT = "/tmp/parquet-input";

// Set the AWS Region.
export const s3Client = new S3Client({ region: "us-east-1" });

const environment = process.argv[2];
if (["production", "staging"].indexOf(environment) === -1) {
  console.error("Usage: node ./compare-uploaded-files.js <production|staging>")
  process.exit(1)
}

const Bucket = environment === "production" ? "log-ingester-production" : "log-ingester-qa";

async function enumerateFiles(prefix) {
  let truncated = true;
  let pageMarker;

  const bucketParams = { Bucket, Prefix: prefix }
  const files = {}
  let pageNum = 1
  while (truncated) {
    try {
      console.log("Listing page", pageNum++)
      const response = await s3Client.send(new ListObjectsCommand(bucketParams));

      for (const item of response.Contents) {
        if (item.Key.endsWith(PARQUET_SUFFIX)) {
          files[item.Key.substring(prefix.length)] = item.Size
        }
      }

      truncated = response.IsTruncated;
      if (truncated) {
        pageMarker = response.Contents.slice(-1)[0].Key;
        bucketParams.Marker = pageMarker;
      }
    } catch (err) {
      console.log("Error", err);
      truncated = false;
    }
  }

  return files
}

async function run() {
  let nonIdFileTotalSize = 0
  let idFileTotalSize = 0

  const missingFiles = {}
  const smallerFiles = {}

  const idFiles = await enumerateFiles("processed_logs_with_id/")
  const nonIdFiles = await enumerateFiles("processed_logs/")

  Object.keys(nonIdFiles).forEach(key => {
    nonIdFileTotalSize += nonIdFiles[key]

    if (!idFiles[key]) {
      missingFiles[key] = nonIdFiles[key]
    } else {
      idFileTotalSize += idFiles[key]
      if (idFiles[key] < nonIdFiles[key]) {
        smallerFiles[key] = nonIdFiles[key]
      }
    }
  })

  console.log("MISSING FILES?", JSON.stringify(missingFiles))
  console.log("SMALLER FILES?", JSON.stringify(smallerFiles))
  console.log({nonIdFileTotalSize, idFileTotalSize})
}
run();
