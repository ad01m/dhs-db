import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true, maxlength: 120 },
  parentName: { type: String, trim: true, maxlength: 120 },
  fatherName: { type: String, required: true, trim: true, maxlength: 120 },
  motherName: { type: String, required: true, trim: true, maxlength: 120 },
  fatherOccupation: { type: String, required: true, trim: true, maxlength: 120 },
  dob: { type: String, required: true, trim: true },
  gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
  category: { type: String, required: true, enum: ['General', 'OBC', 'SC', 'ST', 'EWS'] },
  aadhaarNumber: { type: String, trim: true, match: /^\d{12}$/ },
  studentPhotoUrl: { type: String, trim: true, maxlength: 300 },
  previousSchoolName: { type: String, trim: true, maxlength: 160 },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  whatsappNumber: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
  classApplying: {
    type: String,
    required: true,
    trim: true,
    enum: ['Nursery', 'LKG', 'UKG', ...Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`)],
  },
  targetClass: { type: String, trim: true },
  villageCity: { type: String, required: true, trim: true, maxlength: 120 },
  postOffice: { type: String, required: true, trim: true, maxlength: 120 },
  district: { type: String, required: true, trim: true, maxlength: 120 },
  state: { type: String, required: true, trim: true, maxlength: 120 },
  pinCode: { type: String, required: true, trim: true, match: /^\d{6}$/ },
  address: { type: String, required: true, trim: true, maxlength: 1000 },
  siblingStudying: { type: String, required: true, enum: ['Yes', 'No'] },
  parentDeclaration: { type: Boolean, required: true },
  studentInfoVerified: { type: Boolean, required: true },
  message: { type: String, trim: true, maxlength: 2000 },
  completed: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'reviewed', 'accepted', 'rejected'], default: 'pending' },
}, { timestamps: true })

export default mongoose.model('Admission', schema)
