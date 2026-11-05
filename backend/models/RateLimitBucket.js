import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { versionKey: false })

export default mongoose.model('RateLimitBucket', schema)
