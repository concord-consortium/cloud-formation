import { S3Client, ListObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import parquetjs from 'parquetjs-lite';
import { nanoid } from 'nanoid'
import fs from "fs"
import path from "path"
import mkdirpsync from "mkdirpsync"

const PARQUET_SUFFIX = ".parquet";

const TEMP_INPUT = "/tmp/parquet-input";

// Set the AWS Region.
export const s3Client = new S3Client({ region: "us-east-1" });

const environment = process.argv[2];
if (["production", "staging"].indexOf(environment) === -1) {
  console.error("Usage: node ./add-log-id.js <production|staging> [update]")
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

async function run() {
  if (!update) {
    console.log("NOT UPDATING!")
  }

  // this one missing file was found after running compare-uploaded-files.js
  // it was missing as it already had an id
  const missingFiles = [
    "processed_logs/2022/12/11/16/log_ingester_production-2-2022-12-11-16-08-15-6fdd48d8-e0d8-4092-8469-a07889e853c9.parquet"
  ]

  const nowInSeconds = Date.now() / 1000

  let index = 0
  for (const key of missingFiles) {
    index++
    console.log(`${index} of ${missingFiles.length}: ${key}`)

    try {
      const getResponse = await s3Client.send(new GetObjectCommand({Bucket, Key: key}))

      removeFile(TEMP_INPUT)

      const inputFilePath = await createStreamFile(getResponse.Body, TEMP_INPUT)
      const reader = await parquetjs.ParquetReader.openFile(inputFilePath)
      const cursor = reader.getCursor()

      if (update) {
        const newKey = key.replace(/^processed_logs\//, "processed_logs_with_id/")
        const newPath = `./${newKey}`
        mkdirpsync(path.dirname(newPath))

        const schemaWithId = new parquetjs.ParquetSchema({id: {type: "UTF8"}, ...cursor.schema.schema})
        const writer = await parquetjs.ParquetWriter.openFile(schemaWithId, newPath)

        let row = null;
        while (row = await cursor.next()) {
          // update timestamp to use ms if it was stored in seconds (this was a bug in the initial copy S3 when the log-ingester was setup)
          if (row.timestamp < nowInSeconds) {
            row.timestamp = row.timestamp * BigInt(1000);
          }
          await writer.appendRow({id: nanoid(), ...row})
        }
        await writer.close()
      }
    } catch (err) {
      console.log("Error", key, ":", err);
    }
  }
}
run();
