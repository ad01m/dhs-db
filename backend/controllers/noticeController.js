import mongoose from 'mongoose'
import Notice from '../models/Notice.js'
import { cleanupUnusedUploads } from '../services/uploadCleanup.js'

export async function listNotices(req, res) {
  try {
    res.json(await Notice.find({ published: true }).sort({ createdAt: -1 }).limit(100))
  } catch {
    res.status(500).json({ message: 'Could not fetch notices.' })
  }
}

export async function createNotice(req, res) {
  const { title, content, category, imageUrl, attachmentUrl } = req.body || {}
  try {
    if (!title || !content || String(title).length > 140 || String(content).length > 3000) {
      await cleanupUnusedUploads([imageUrl, attachmentUrl])
      return res.status(400).json({ message: 'Add a title and notice text (maximum 140 and 3000 characters).' })
    }
    for (const url of [imageUrl, attachmentUrl].filter(Boolean)) {
      if (!String(url).startsWith('/uploads/')) {
        await cleanupUnusedUploads([imageUrl, attachmentUrl])
        return res.status(400).json({ message: 'Upload attachments from your device before publishing.' })
      }
    }
    const notice = await Notice.create({ title, content, category, imageUrl, attachmentUrl, createdBy: req.user.id })
    res.status(201).json(notice)
  } catch {
    await cleanupUnusedUploads([imageUrl, attachmentUrl])
    res.status(400).json({ message: 'Could not publish notice. Please check the required fields.' })
  }
}

export async function deleteNotice(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid notice ID.' })
    const notice = await Notice.findByIdAndDelete(req.params.id)
    if (!notice) return res.status(404).json({ message: 'Notice not found.' })
    await cleanupUnusedUploads([notice.imageUrl, notice.attachmentUrl])
    res.json({ message: 'Notice deleted.' })
  } catch {
    res.status(500).json({ message: 'Could not delete notice.' })
  }
}
