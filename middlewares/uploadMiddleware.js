const multer = require("multer");
const AWS = require("aws-sdk");
const { s3Client } = require("../config/s3"); // Import AWS S3 configuration

// Set up multer memory storage so the file is temporarily held in memory before uploading to S3
const storage = multer.memoryStorage();

// Set up file filter to allow only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true); // Allow image files
  } else {
    cb(new Error("Not an image! Please upload an image file."), false); // Reject non-image files
  }
};

// Set up multer upload configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});

// Function to upload image to S3
const uploadToS3 = async (file) => {
  try {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME, // Your S3 bucket name
      Key: `user-profile-images/${Date.now()}-${file.originalname}`, // Define the key (path) in the S3 bucket
      Body: file.buffer, // The file content from multer memory storage
      ContentType: file.mimetype, // Set the content type as the file's mimetype
      ACL: "public-read", // Optional: Set the access control list (public-read to make it publicly accessible)
    };

    // Upload the file to S3
    const uploadResult = await s3Client.upload(params).promise();

    return uploadResult; // Return the result which includes the file's URL in S3
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error("Failed to upload to S3.");
  }
};

// Use the upload middleware and then upload to S3
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    // Upload the image to S3
    const s3Response = await uploadToS3(req.file);

    // Send the uploaded file's URL as the response
    res.status(200).json({
      message: "Image uploaded successfully!",
      imageUrl: s3Response.Location, // S3 URL for the uploaded image
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { upload, uploadImage };
