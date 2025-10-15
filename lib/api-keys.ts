// lib/api-keys.ts
export function getAPIKey(): string {
  const key = process.env.OPENROUTER_API_KEY
  
  if (!key) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }
  
  return key
}

// Add API key validation
export function validateAPIKey(): boolean {
  try {
    const key = getAPIKey()
    return key.length > 20 // Basic validation
  } catch {
    return false
  }
}