import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Admission from '../models/Admission.js'
import { cleanupUnusedUploads } from '../services/uploadCleanup.js'

const allowedClasses = new Set(['Nursery', 'LKG', 'UKG', ...Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`)])
const allowedCategories = new Set(['General', 'OBC', 'SC', 'ST', 'EWS'])
const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')

function invalidPhoto(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

async function saveStudentPhoto(dataUrl) {
  if (!dataUrl) return ''
  const match = typeof dataUrl === 'string' && dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match) throw invalidPhoto('Choose a JPG, PNG or WebP student photo.')

  const mime = match[1]
  const base64 = match[2]
  const bytes = Buffer.from(base64, 'base64')
  if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
    throw invalidPhoto('The selected student photo could not be read.')
  }
  if (bytes.length > 3 * 1024 * 1024) throw invalidPhoto('Student photo must be 3 MB or smaller.')

  const validSignature = mime === 'image/jpeg'
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mime === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!validSignature) throw invalidPhoto('The selected file does not match a supported image type.')

  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime]
  const filename = `${randomUUID()}.${extension}`
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), bytes, { flag: 'wx' })
  return `/uploads/${filename}`
}

export async function submitAdmission(req, res) {
  const body = req.body || {}
  const classApplying = String(body.targetClass || body.classApplying || '').trim()

  if (!body.studentName || !body.fatherName || !body.motherName || !body.dob || !body.gender ||
    !body.phone || !body.fatherOccupation || !body.villageCity || !body.postOffice || !body.district ||
    !body.state || !body.pinCode || !allowedClasses.has(classApplying) || !allowedCategories.has(body.category) ||
    !['Yes', 'No'].includes(body.siblingStudying) || body.parentDeclaration !== true || body.studentInfoVerified !== true) {
    return res.status(400).json({ message: 'Complete the required admission fields and both declarations.' })
  }
  if (!/^[6-9]\d{9}$/.test(String(body.phone))) {
    return res.status(400).json({ message: 'Enter a valid 10 digit Indian mobile number.' })
  }
  if (body.whatsappNumber && !/^[6-9]\d{9}$/.test(String(body.whatsappNumber))) {
    return res.status(400).json({ message: 'Enter a valid 10 digit WhatsApp number.' })
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' })
  }
  if (body.aadhaarNumber && !/^\d{12}$/.test(String(body.aadhaarNumber))) {
    return res.status(400).json({ message: 'Enter a valid 12 digit Aadhaar number.' })
  }
  if (!/^\d{6}$/.test(String(body.pinCode))) {
    return res.status(400).json({ message: 'Enter a valid 6 digit PIN Code.' })
  }

  let studentPhotoUrl = ''
  try {
    studentPhotoUrl = await saveStudentPhoto(body.studentPhotoDataUrl)
    const address = [body.villageCity, body.postOffice, body.district, body.state, body.pinCode]
      .map((part) => String(part).trim())
      .join(', ')
    const application = await Admission.create({
      studentName: body.studentName,
      fatherName: body.fatherName,
      motherName: body.motherName,
      fatherOccupation: body.fatherOccupation,
      dob: body.dob,
      gender: body.gender,
      category: body.category,
      aadhaarNumber: body.aadhaarNumber || undefined,
      studentPhotoUrl: studentPhotoUrl || undefined,
      previousSchoolName: body.previousSchoolName || undefined,
      email: body.email || undefined,
      phone: body.phone,
      whatsappNumber: body.whatsappNumber || undefined,
      classApplying,
      targetClass: classApplying,
      villageCity: body.villageCity,
      postOffice: body.postOffice,
      district: body.district,
      state: body.state,
      pinCode: body.pinCode,
      address,
      siblingStudying: body.siblingStudying,
      parentDeclaration: true,
      studentInfoVerified: true,
      completed: false,
      status: 'pending',
      message: body.message || undefined,
    })
    return res.status(201).json({ message: 'Admission enquiry submitted successfully.', applicationId: application._id })
  } catch (error) {
    if (studentPhotoUrl) await cleanupUnusedUploads([studentPhotoUrl])
    console.error('Admission submission error:', error.message)
    return res.status(error.status || 400).json({
      message: error.name === 'ValidationError' ? 'Please check the admission form fields.' : error.message || 'Could not submit admission enquiry.',
    })
  }
}

export async function listAdmissions(req, res) {
  try {
    return res.json(await Admission.find().sort({ createdAt: -1 }).limit(500))
  } catch {
    return res.status(500).json({ message: 'Could not fetch admission applications.' })
  }
}

export async function updateAdmissionStatus(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid application ID.' })
    const changes = {}
    if (typeof req.body?.completed === 'boolean') changes.completed = req.body.completed
    else if (['pending', 'reviewed', 'accepted', 'rejected'].includes(req.body?.status)) changes.status = req.body.status
    else return res.status(400).json({ message: 'Provide a valid completion value or application status.' })
    const item = await Admission.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true })
    if (!item) return res.status(404).json({ message: 'Application not found.' })
    return res.json(item)
  } catch {
    return res.status(400).json({ message: 'Could not update application.' })
  }
}

export async function deleteAdmission(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid application ID.' })
    const item = await Admission.findByIdAndDelete(req.params.id)
    if (!item) return res.status(404).json({ message: 'Application not found.' })
    await cleanupUnusedUploads([item.studentPhotoUrl])
    return res.json({ message: 'Admission application deleted.' })
  } catch {
    return res.status(500).json({ message: 'Could not delete admission application.' })
  }
}
