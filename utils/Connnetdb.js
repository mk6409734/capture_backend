import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.MONGO_URL) {
  throw new Error("please provide MONGO_URL in the .env file");
}

export const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ connected Mongodb 🔗");
  } catch (error) {
    console.log(" ❎ mongodb connect error", error);
    process.exit(1);
  }
};
