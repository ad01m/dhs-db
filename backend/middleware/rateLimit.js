import { createHmac } from 'node:crypto'
import RateLimitBucket from '../models/RateLimitBucket.js'

export function rateLimit({ windowMs, max, message }) {
  return async (req, res, next) => {
    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs
    const resetAt = windowStart + windowMs
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown'
    const ipHash = createHmac('sha256', process.env.JWT_SECRET)
      .update(clientIp)
      .digest('hex')
    const routeKey = `${req.baseUrl}${req.path}:${ipHash}:${windowStart}`
    const update = {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(resetAt) },
    }

    try {
      let bucket
      try {
        bucket = await RateLimitBucket.findOneAndUpdate(
          { key: routeKey },
          update,
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
      } catch (error) {
        // Concurrent first requests can race to create the same unique bucket.
        if (error.code !== 11000) throw error
        bucket = await RateLimitBucket.findOneAndUpdate(
          { key: routeKey },
          { $inc: { count: 1 } },
          { new: true },
        )
      }

      const remaining = Math.max(0, max - bucket.count)
      res.set('RateLimit-Limit', String(max))
      res.set('RateLimit-Remaining', String(remaining))
      res.set('RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
      if (bucket.count > max) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - now) / 1000))))
        return res.status(429).json({ message })
      }
      return next()
    } catch (error) {
      console.error('Rate limit storage failed:', error.message)
      return res.status(503).json({ message: 'This service is temporarily unavailable. Please try again shortly.' })
    }
  }
}
