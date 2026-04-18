import { Router } from 'express'
import admin from 'firebase-admin'

const router = Router()

router.get('/me', async (req, res) => {
  try {
    const userRecord = await admin.auth().getUser(req.userId!)
    res.json({
      uid: userRecord.uid,
      email: userRecord.email ?? null,
      displayName: userRecord.displayName ?? null,
      photoURL: userRecord.photoURL ?? null,
    })
  } catch {
    res.status(404).json({ error: 'User not found' })
  }
})

export default router
