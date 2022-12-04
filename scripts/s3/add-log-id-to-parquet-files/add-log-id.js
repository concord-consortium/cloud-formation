import { S3Client, ListObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import parquetjs from 'parquetjs';
import { nanoid } from 'nanoid'
import fs from "fs"

const PARQUET_SUFFIX = ".parquet";

const TEMP_INPUT = "/tmp/parquet-input";
const TEMP_OUTPUT = "/tmp/parquet-output";

// Set the AWS Region.
export const s3Client = new S3Client({ region: "us-east-1" });

const environment = process.argv[2];
if (["production", "staging"].indexOf(environment) === -1) {
  console.error("Usage: node ./list-files.js <production|staging> [update]")
  process.exit(1)
}
const update = process.argv[3] === "update"
const Bucket = environment === "production" ? "log-ingester-production" : "log-ingester-qa";

const bucketParams = { Bucket, Prefix: "processed_logs/" };

async function createStreamFile(stream, filePath) {
  return new Promise(resolve => {
    let b = fs.createWriteStream(filePath);
    b.on('finish', () => resolve(filePath));
    stream.pipe(b)
  })
}

function removeFile(path) {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
}

const secInMS = 1000;
const minuteInMS = secInMS * 60;
const hourInMS = minuteInMS * 60;

function niceTime(ms) {
  let time = ms;

  const hours = Math.floor(time / hourInMS);
  time -= (hours * hourInMS)

  const minutes = Math.floor(time / minuteInMS);
  time -= (minutes * minuteInMS)

  const seconds = time / secInMS;

  const result = [];
  if (hours > 0) {
    result.push(`${hours.toFixed(2)}h`)
  }
  if (minutes > 0) {
    result.push(`${minutes.toFixed(2)}m`)
  }
  result.push(`${seconds.toFixed(2)}s`)

  return result.join(" ")
}

async function run() {
  const startTime = new Date()

  if (!update) {
    console.log("NOT UPDATING!")
  }

  let truncated = true;
  let pageMarker;

  // gather a list of all files
  let pageNum = 1
  const allKeys = []
  while (truncated) {
    try {
      console.log("Listing page", pageNum++)
      const response = await s3Client.send(new ListObjectsCommand(bucketParams));

      for (const item of response.Contents) {
        allKeys.push(item.Key)
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

  console.log("Total number of keys found:", allKeys.length)

  const nowInSeconds = Date.now() / 1000

  let index = 0;
  const startUpdateTime = Date.now();

  for (const key of allKeys) {
    try {
      const getResponse = await s3Client.send(new GetObjectCommand({Bucket, Key: key}))

      removeFile(TEMP_INPUT)
      removeFile(TEMP_OUTPUT)

      const inputFilePath = await createStreamFile(getResponse.Body, TEMP_INPUT)
      const reader = await parquetjs.ParquetReader.openFile(inputFilePath)
      const cursor = reader.getCursor()

      const hasId = Object.keys(cursor.schema.schema).indexOf("id") !== -1;
      if (!hasId) {
        if (update) {
          const schemaWithId = new parquetjs.ParquetSchema({id: {type: "UTF8"}, ...cursor.schema.schema})
          const writer = await parquetjs.ParquetWriter.openFile(schemaWithId, TEMP_OUTPUT)

          let row = null;
          while (row = await cursor.next()) {
            // update timestamp to use ms if it was stored in seconds (this was a bug in the initial copy S3 when the log-ingester was setup)
            if (row.timestamp < nowInSeconds) {
              row.timestamp = row.timestamp * 1000;
            }
            await writer.appendRow({id: nanoid(), ...row})
          }
          await writer.close()

          const newKey = key.replace(/^processed_logs\//, "processed_logs_with_id/")
          const putResponse = await s3Client.send(new PutObjectCommand({Bucket, Key: newKey, Body: fs.readFileSync(TEMP_OUTPUT)}))

          index++
          const now = Date.now()
          const elapsed = now - startUpdateTime
          const perUpdate = elapsed / index
          const remaining = (allKeys.length - index) * perUpdate;
          console.log(`${index} of ${allKeys.length}: ${newKey} (elapsed: ${niceTime(elapsed)}, perUpdate: ${niceTime(perUpdate)}, remaining: ${niceTime(remaining)})`)

          // if (index >= 20) {
          //   process.exit(1)
          // }
        } else {
          console.log(key, "NO ID")
        }
      } else {
        console.log(key, "ALREADY HAS ID")
      }
    } catch (err) {
      console.log("Error", err);
      truncated = false;
    }
  }

  const duration = new Date() - startTime

  console.log(`\n\nTOTAL TIME: ${niceTime(duration)} (${duration})`)
}
run();
