// Import the required client and commands from AWS SDK v3
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");
require("aws-sdk/lib/maintenance_mode_message").suppress = true;

const s3Client = new S3Client({
  region: process.env.AWS_REGION, // specify your region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const verifyS3Connection = async () => {
  try {
    // Using ListBucketsCommand to list buckets
    const data = await s3Client.send(new ListBucketsCommand({}));
    console.log("S3 Connection Verified:");
  } catch (error) {
    console.error("Error accessing S3:", error);
  }
};

module.exports = { s3Client, verifyS3Connection };
