import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import admissionRoutes from './routes/admissionRoutes.js'
import contactRoutes from './routes/contactRoutes.js'
import noticeRoutes from './routes/noticeRoutes.js'
import galleryRoutes from './routes/galleryRoutes.js'
import settingsRoutes from './routes/settingsRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'

dotenv.config()
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 characters.')
}

const app = express()
// The API is reached through one local proxy (Vite in development, Nginx in Docker).
app.set('trust proxy', 1)
const serverDir = path.dirname(fileURLToPath(import.meta.url))
app.use('/uploads', express.static(path.join(serverDir, 'uploads'), { maxAge: '7d', immutable: true }))

const origins = process.env.CLIENT_URL?.split(',').map((origin) => origin.trim())
app.use(cors({
  origin: (origin, callback) => !origin || !origins?.length || origins.includes(origin)
    ? callback(null, true)
    : callback(new Error('Origin not allowed')),
  credentials: true,
}))
app.use(express.json({ limit: '12mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.get('/', (req, res) => res.json({ message: 'DHS Web Backend is running!' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/admissions', admissionRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/notices', noticeRoutes)
app.use('/api/gallery', galleryRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/uploads', uploadRoutes)
app.use((req, res) => res.status(404).json({ message: 'API route not found.' }))
app.use((error, req, res, next) => {
  console.error(error.stack || error)
  res.status(error.status || 500).json({ message: error.message || 'Internal server error.' })
})

const port = process.env.PORT || 5000
connectDB()
  .then(() => app.listen(port, () => console.log(`DHS API running on port ${port}`)))
  .catch((error) => {
    console.error('Database connection failed:', error.message)
    process.exit(1)
  })
