import { URL } from 'url'

// FIXME:  blow up at import time if ALLOWED_ORIGINS is not configured
//
export function isWhitelisted(url: string): boolean {
  // console.log(`in isWhitelisted(${url})`)
  if (!process.env.ALLOWED_ORIGINS) {
    console.log(`env.ALLOWED_ORIGINS not configured`)
    return false
  }
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',')
  // console.log(`allowedOrigins: ${JSON.stringify(allowedOrigins)}`)
  try {
    const targetUrl = new URL(url)
    return allowedOrigins.some(origin => {
      try {
        const allowedUrl = new URL(origin)
        return allowedUrl.origin == targetUrl.origin
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

export function validateNavigation(currentUrl: string, targetUrl: string): boolean {
  if (!isWhitelisted(targetUrl)) return false
  
  try {
    const current = new URL(currentUrl)
    const target = new URL(targetUrl)
    return current.origin === target.origin || isWhitelisted(targetUrl)
  } catch {
    return false
  }
}
