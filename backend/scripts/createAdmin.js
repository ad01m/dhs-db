import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dhs_school'
const explicitUserId = String(process.env.ADMIN_USER_ID || '').trim().toLowerCase()
const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const userId = explicitUserId || email
const password = process.env.ADMIN_PASSWORD
const name = String(process.env.ADMIN_NAME || 'School Administrator').trim()

if (!userId || !email || !password) {
  console.error('Set ADMIN_EMAIL, ADMIN_PASSWORD and optionally ADMIN_USER_ID in the environment.')
  process.exit(1)
}
if (password.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

try {
  await mongoose.connect(uri)
  let admin = await User.findOne({ userId }).select('+password')

  if (!admin && !explicitUserId) {
    const existingAdmins = await User.find({ role: 'admin' }).limit(2).select('+password')
    if (existingAdmins.length === 1) admin = existingAdmins[0]
    else if (existingAdmins.length > 1) {
      throw new Error('More than one admin exists. Set ADMIN_USER_ID to the intended account ID before syncing credentials.')
    }
  } else if (!admin && explicitUserId && await User.exists({ role: 'admin' })) {
    throw new Error('ADMIN_USER_ID did not match an existing admin. Check the configured login ID to avoid creating a duplicate account.')
  }

  if (admin) {
    const passwordMatches = await bcrypt.compare(password, admin.password)
    admin.name = name
    admin.email = email
    admin.userId = userId
    admin.isActive = true
    if (!passwordMatches) admin.password = await bcrypt.hash(password, 12)
    await admin.save()
    console.log(`Admin account synchronized for ${userId}.`)
  } else {
    const hashed = await bcrypt.hash(password, 12)
    await User.create({ name, userId, email, password: hashed, role: 'admin' })
    console.log(`Admin account created. Login ID: ${userId}`)
  }
} catch (error) {
  console.error('Could not create or synchronize admin:', error.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
