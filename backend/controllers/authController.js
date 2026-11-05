import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import SchoolSettings from "../models/SchoolSettings.js";
import { cleanupUnusedUploads } from "../services/uploadCleanup.js";

function makeToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export async function login(req, res) {
  try {
    const { userId, email, password, role } = req.body || {};
    const loginId = String(userId || email || "").trim().toLowerCase();
    if (!loginId || !password) return res.status(400).json({ message: "User ID/email and password are required." });

    const user = await User.findOne({ userId: loginId }).select("+password");
    if (!user || !user.isActive || user.role !== "admin") return res.status(401).json({ message: "Invalid login credentials." });
    if (role && role !== "admin") return res.status(403).json({ message: "Only administrator sign-in is available." });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid login credentials." });

    return res.json({
      message: "Login successful",
      token: makeToken(user),
      user: { id: user._id, userId: user.userId, email: user.email, phone: user.phone, profileImage: user.profileImage, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Unable to login right now." });
  }
}

export async function getMe(req, res) {
  res.json({ user: req.user });
}

export async function updateMe(req, res) {
  const { name, email, phone, profileImage, currentPassword, schoolName } = req.body || {};
  try {
    if (typeof currentPassword !== "string" || !currentPassword) {
      await cleanupUnusedUploads([profileImage]);
      return res.status(400).json({ message: "Enter your current admin password to confirm profile changes." });
    }
    if (!name || String(name).trim().length < 2 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await cleanupUnusedUploads([profileImage]);
      return res.status(400).json({ message: "Enter your name and a valid email address." });
    }
    if (phone && !/^[+\d\s()-]{7,20}$/.test(phone)) {
      await cleanupUnusedUploads([profileImage]);
      return res.status(400).json({ message: "Enter a valid phone number." });
    }
    if (schoolName !== undefined && (typeof schoolName !== "string" || !schoolName.trim() || schoolName.trim().length > 160)) {
      await cleanupUnusedUploads([profileImage]);
      return res.status(400).json({ message: "Enter a school name between 1 and 160 characters." });
    }
    if (profileImage && !String(profileImage).startsWith("/uploads/")) {
      await cleanupUnusedUploads([profileImage]);
      return res.status(400).json({ message: "Upload your profile picture from your device." });
    }
    const current = await User.findById(req.user.id).select("+password");
    if (!current) {
      await cleanupUnusedUploads([profileImage]);
      return res.status(404).json({ message: "Administrator account not found." });
    }
    if (!(await bcrypt.compare(currentPassword, current.password))) {
      await cleanupUnusedUploads([profileImage]);
      return res.status(401).json({ message: "Current admin password is incorrect. Profile was not updated." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailInUse = await User.exists({ email: normalizedEmail, _id: { $ne: req.user.id } });
    if (emailInUse) {
      await cleanupUnusedUploads([profileImage]);
      return res.status(409).json({ message: "That email address is already in use." });
    }
    const changes = { name: name.trim(), email: normalizedEmail, phone: phone?.trim(), profileImage };
    if (current.userId === current.email) changes.userId = normalizedEmail;
    if (schoolName !== undefined) {
      await SchoolSettings.findOneAndUpdate(
        { key: "school" },
        { $set: { schoolName: schoolName.trim() } },
        { new: true, upsert: true, runValidators: true },
      );
    }
    const user = await User.findByIdAndUpdate(req.user.id, changes, { new: true, runValidators: true });
    if (current.profileImage && current.profileImage !== profileImage) await cleanupUnusedUploads([current.profileImage]);
    res.json({ user: { id: user._id, userId: user.userId, name: user.name, email: user.email, phone: user.phone, profileImage: user.profileImage, role: user.role }, schoolName: schoolName?.trim() });
  } catch (error) {
    await cleanupUnusedUploads([profileImage]);
    if (error.code === 11000) return res.status(409).json({ message: "That email address is already in use." });
    res.status(400).json({ message: "Could not update administrator profile." });
  }
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || !currentPassword || typeof newPassword !== "string") {
    return res.status(400).json({ message: "Enter your current password and a new password." });
  }
  if (newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72) {
    return res.status(400).json({ message: "New password must be at least 8 characters and no more than 72 bytes." });
  }
  try {
    const user = await User.findById(req.user.id).select("+password");
    if (!user || !user.isActive || user.role !== "admin") {
      return res.status(401).json({ message: "Administrator account not found or inactive." });
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ message: "Current password is incorrect. Password was not changed." });
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ message: "Choose a new password that differs from your current password." });
    }
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    return res.json({ message: "Admin password changed successfully." });
  } catch (error) {
    console.error("Password change error:", error.message);
    return res.status(500).json({ message: "Could not change the admin password." });
  }
}

export async function createUser(req, res) {
  try {
    const { name, userId, email, password, role } = req.body || {};
    if (!name || !userId || !password || !role) {
      return res.status(400).json({ message: "name, userId, password and role are required." });
    }
    if (role !== "admin") {
      return res.status(400).json({ message: "Invalid role." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }
    const normalizedId = String(userId).trim().toLowerCase();
    if (await User.findOne({ userId: normalizedId })) {
      return res.status(409).json({ message: "This user ID already exists." });
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, userId: normalizedId, email, password: hashed, role });
    res.status(201).json({ message: "User created", user: { id: user._id, name: user.name, userId: user.userId, role: user.role } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "User ID or email already exists." });
    console.error("Create user error:", error.message);
    res.status(500).json({ message: "Unable to create user." });
  }
}

