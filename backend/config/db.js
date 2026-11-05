import mongoose from "mongoose";
import RateLimitBucket from "../models/RateLimitBucket.js";

export default async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dhs_school";
  try {
    await mongoose.connect(uri);
    await RateLimitBucket.createIndexes();
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}
