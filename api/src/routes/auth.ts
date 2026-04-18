import { Router } from 'express'
import admin from 'firebase-admin'

const router = Router()

router.get('/me', async (req, res) => {
  const uid = req.userId!

  try {
    const userRecord = await admin.auth().getUser(uid)
    res.json({
      uid: userRecord.uid,
      email: userRecord.email ?? null,
      displayName: userRecord.displayName ?? null,
      photoURL: userRecord.photoURL ?? null,
    })
  } catch (err) {
    console.error('auth/me getUser failed:', err)
    res.json({
      uid,
      email: null,
      displayName: null,
      photoURL: null,
    })
  }
})

export default router
