import { Router } from 'express'
import bcrypt from 'bcryptjs'
import Settings from '../models/SchoolSettings.js'
import User from '../models/User.js'
import { protect, allowRoles } from '../middleware/authMiddleware.js'
import { cleanupUnusedUploads } from '../services/uploadCleanup.js'

const router = Router()
const defaultSettings = {
  schoolName: 'Divyanshu Higher Secondary School',
  address: 'Tarabganj Road, Gonda, Uttar Pradesh',
  officeHours: 'Monday to Saturday, 8:00 AM to 2:00 PM',
  leaders: [
    { name: 'Avanish Shukla', role: 'Principal' },
    { name: 'Ram Banaras Shukla', role: 'Founder' },
    { name: 'Ram Kripal Shukla', role: 'Manager' },
  ],
}

router.get('/', async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'school' }).lean()
    if (!settings) return res.json(defaultSettings)
    if (!Array.isArray(settings.leaders)) settings.leaders = defaultSettings.leaders
    if (!settings.officeHours) settings.officeHours = defaultSettings.officeHours
    res.json(settings)
  } catch {
    res.status(500).json({ message: 'Could not fetch school settings.' })
  }
})

router.put('/', protect, allowRoles('admin'), async (req, res) => {
  const allowed = ['schoolName', 'address', 'phone', 'email', 'officeHours', 'principalMessage', 'leaders']
  const changes = Object.fromEntries(allowed
    .filter((key) => req.body?.[key] !== undefined)
    .map((key) => [key, req.body[key]]))
  const photoUrls = (Array.isArray(changes.leaders) ? changes.leaders : [])
    .map((leader) => leader?.photo)
    .filter(Boolean)

  if (typeof req.body?.currentPassword !== 'string' || !req.body.currentPassword) {
    await cleanupUnusedUploads(photoUrls)
    return res.status(400).json({ message: 'Enter your current admin password to save school settings.' })
  }
  try {
    const admin = await User.findById(req.user.id).select('+password')
    if (!admin || !(await bcrypt.compare(req.body.currentPassword, admin.password))) {
      await cleanupUnusedUploads(photoUrls)
      return res.status(401).json({ message: 'Current admin password is incorrect. School settings were not saved.' })
    }
  } catch {
    await cleanupUnusedUploads(photoUrls)
    return res.status(500).json({ message: 'Could not verify the admin password.' })
  }

  if (changes.phone && !/^[+\d\s()-]{7,20}$/.test(changes.phone)) {
    await cleanupUnusedUploads(photoUrls)
    return res.status(400).json({ message: 'Enter a valid school phone number.' })
  }
  if (changes.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) {
    await cleanupUnusedUploads(photoUrls)
    return res.status(400).json({ message: 'Enter a valid school email address.' })
  }
  if (changes.officeHours !== undefined && (typeof changes.officeHours !== 'string' || changes.officeHours.length > 160)) {
    await cleanupUnusedUploads(photoUrls)
    return res.status(400).json({ message: 'Office hours must be 160 characters or fewer.' })
  }
  if (changes.leaders && (!Array.isArray(changes.leaders) || changes.leaders.some((leader) =>
    !leader || !leader.name?.trim() || !leader.role?.trim() || (leader.message !== undefined && (typeof leader.message !== 'string' || leader.message.length > 1000)) || (leader.photo && !String(leader.photo).startsWith('/uploads/'))))) {
    await cleanupUnusedUploads(photoUrls)
    return res.status(400).json({ message: 'Every school leader needs a name and role. Upload photos from your device.' })
  }

  try {
    const previous = await Settings.findOne({ key: 'school' }).lean()
    const settings = await Settings.findOneAndUpdate(
      { key: 'school' },
      { $set: changes },
      { new: true, upsert: true, runValidators: true },
    )
    const oldPhotos = (previous?.leaders || []).map((leader) => leader.photo).filter(Boolean)
    await cleanupUnusedUploads(oldPhotos)
    res.json(settings)
  } catch {
    await cleanupUnusedUploads(photoUrls)
    res.status(400).json({ message: 'Could not save school settings.' })
  }
})

export default router
