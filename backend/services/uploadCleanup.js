import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import GalleryItem from '../models/GalleryItem.js'
import Notice from '../models/Notice.js'
import SchoolSettings from '../models/SchoolSettings.js'
import User from '../models/User.js'
import Admission from '../models/Admission.js'

const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')
const uploadedFilePattern = /^\/uploads\/([0-9a-f-]{36}\.(?:jpg|png|webp|pdf))$/i

export async function cleanupUnusedUploads(urls = []) {
  for (const url of new Set(urls.filter(Boolean))) {
    const match = typeof url === 'string' && url.match(uploadedFilePattern)
    if (!match) continue

    try {
      const [galleryReference, noticeReference, settingsReference, userReference, admissionReference] = await Promise.all([
        GalleryItem.exists({ imageUrl: url }),
        Notice.exists({ $or: [{ imageUrl: url }, { attachmentUrl: url }] }),
        SchoolSettings.exists({ 'leaders.photo': url }),
        User.exists({ profileImage: url }),
        Admission.exists({ studentPhotoUrl: url }),
      ])
      if (galleryReference || noticeReference || settingsReference || userReference || admissionReference) continue
      await unlink(path.join(uploadDir, match[1]))
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn(`Could not clean up upload ${match[1]}:`, error.message)
    }
  }
}
