import { Router } from 'express'
import mongoose from 'mongoose'
import GalleryItem from '../models/GalleryItem.js'
import { protect, allowRoles } from '../middleware/authMiddleware.js'
import { cleanupUnusedUploads } from '../services/uploadCleanup.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    res.json(await GalleryItem.find({ published: true }).sort({ createdAt: -1 }).limit(200))
  } catch {
    res.status(500).json({ message: 'Could not fetch gallery.' })
  }
})

router.post('/', protect, allowRoles('admin'), async (req, res) => {
  const { imageUrl, caption } = req.body || {}
  if (!imageUrl || !String(imageUrl).startsWith('/uploads/')) {
    await cleanupUnusedUploads([imageUrl])
    return res.status(400).json({ message: 'Upload a photo from your device first.' })
  }
  try {
    res.status(201).json(await GalleryItem.create({ imageUrl, caption }))
  } catch {
    await cleanupUnusedUploads([imageUrl])
    res.status(400).json({ message: 'Could not add gallery photo.' })
  }
})

router.delete('/:id', protect, allowRoles('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid photo ID.' })
    const item = await GalleryItem.findByIdAndDelete(req.params.id)
    if (!item) return res.status(404).json({ message: 'Photo not found.' })
    await cleanupUnusedUploads([item.imageUrl])
    res.json({ message: 'Photo deleted.' })
  } catch {
    res.status(500).json({ message: 'Could not delete photo.' })
  }
})

export default router
