/**
 * AES-256-GCM encryption for sensitive secrets stored at rest (currently
 * Google OAuth access/refresh tokens).
 *
 * The key comes from the `TOKEN_ENCRYPTION_KEY` env var — 64 hex characters
 * (32 bytes). Generate one with:  `openssl rand -hex 32`
 *
 * If the key is unset or malformed, callers should treat the dependent
 * integration as disabled rather than crashing the API.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'hex')
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return key
}

/** True when a valid 32-byte key is configured. */
export function isEncryptionConfigured(): boolean {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  return typeof raw === 'string' && Buffer.from(raw, 'hex').length === 32
}

/**
 * Encrypts a UTF-8 string. Output format is `iv:authTag:ciphertext`, all hex.
 * A fresh random IV is used per call, so encrypting the same plaintext twice
 * yields different ciphertext.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':')
}

/** Reverses {@link encrypt}. Throws on a malformed payload or auth-tag mismatch. */
export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Malformed ciphertext')
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}
