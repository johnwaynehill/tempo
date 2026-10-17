import { Router } from 'express'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

// A device registers its APNs token here after the user allows notifications
// (Docs/PushNotifications.md). Registering a token that belongs to another account moves it:
// whoever is signed in on the phone now is who it notifies.

const router = Router()

const TOKEN_RE = /^[0-9a-f]{64,200}$/i
const ENVIRONMENTS = new Set(['sandbox', 'production'])

// PUT /api/push/devices  { token, environment: 'sandbox' | 'production', bundleId? }
router.put('/devices', async (req, res) => {
  const { token, environment, bundleId } = req.body ?? {}
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
    res.status(400).json({ error: 'token must be a hex APNs device token' }); return
  }
  if (typeof environment !== 'string' || !ENVIRONMENTS.has(environment)) {
    res.status(400).json({ error: "environment must be 'sandbox' or 'production'" }); return
  }
  const values = {
    token: token.toLowerCase(),
    userId: req.userId!,
    environment,
    bundleId: typeof bundleId === 'string' && bundleId ? bundleId : 'com.johnwaynehill.Tempo',
    updatedAt: new Date(),
  }
  const [row] = await db
    .insert(schema.pushDevices)
    .values(values)
    .onConflictDoUpdate({ target: schema.pushDevices.token, set: values })
    .returning()
  res.json(row)
})

// DELETE /api/push/devices/:token — sign-out, or the user turned notifications off.
router.delete('/devices/:token', async (req, res) => {
  await db.delete(schema.pushDevices).where(and(
    eq(schema.pushDevices.token, req.params.token.toLowerCase()),
    eq(schema.pushDevices.userId, req.userId!),
  ))
  res.status(204).send()
})

export default router
