import express from 'express'
import { getProfile, uploadAvatar, updateProfile, updatePassword } from '../controllers/user.controller.js'
import multer from 'multer'
const router = express.Router()

const storage = multer.memoryStorage()
const upload = multer({ storage })

router.get('/profile', getProfile)
router.post('/profile/avatar/upload', upload.single('image'), uploadAvatar)
router.post('/profile/update', updateProfile)
router.post('/profile/password/update', updatePassword)
export default router