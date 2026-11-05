import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  userId: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  phone: { type: String, trim: true, maxlength: 20 },
  profileImage: { type: String, trim: true, maxlength: 300 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin"], required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("User", userSchema);

