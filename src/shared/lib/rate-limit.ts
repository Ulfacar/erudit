/**
 * Simple in-memory rate limiter (no Redis needed for MVP).
 * Tracks requests per IP, returns 429 if exceeded.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimit = new Map<string, RateLimitEntry>()

// Periodic cleanup to prevent memory leaks (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimit) {
      if (now > entry.resetAt) {
        rateLimit.delete(key)
      }
    }
  }, CLEANUP_INTERVAL)
  // Allow Node to exit even if the timer is still running
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref()
  }
}

/**
 * Check if a request from the given IP is allowed.
 *
 * @param ip - Client IP address
 * @param limit - Maximum number of requests in the window (default: 100)
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(ip: string, limit = 100, windowMs = 60000): boolean {
  ensureCleanup()

  const now = Date.now()
  const entry = rateLimit.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  entry.count++

  if (entry.count > limit) {
    return false
  }

  return true
}

/**
 * Get the client IP from a Next.js request.
 * Checks x-forwarded-for header first (for reverse proxy setups), then falls back to x-real-ip.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return '127.0.0.1'
}
