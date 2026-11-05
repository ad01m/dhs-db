import mongoose from 'mongoose'

const leaderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  role: { type: String, required: true, trim: true, maxlength: 80 },
  message: { type: String, trim: true, maxlength: 1000, default: '' },
  photo: { type: String, trim: true, maxlength: 300 },
}, { _id: true })

const schema = new mongoose.Schema({
  key: { type: String, default: 'school', unique: true },
  schoolName: { type: String, trim: true, maxlength: 160, default: 'Divyanshu Higher Secondary School' },
  address: { type: String, trim: true, maxlength: 400, default: 'Tarabganj Road, Gonda, Uttar Pradesh' },
  phone: { type: String, trim: true, maxlength: 20 },
  email: { type: String, trim: true, lowercase: true, maxlength: 160 },
  officeHours: { type: String, trim: true, maxlength: 160, default: 'Monday to Saturday, 8:00 AM to 2:00 PM' },
  principalMessage: { type: String, trim: true, maxlength: 1500 },
  leaders: {
    type: [leaderSchema],
    default: () => [
      { name: 'Avanish Shukla', role: 'Principal' },
      { name: 'Ram Banaras Shukla', role: 'Founder' },
      { name: 'Ram Kripal Shukla', role: 'Manager' },
    ],
  },
}, { timestamps: true })

export default mongoose.model('SchoolSettings', schema)
