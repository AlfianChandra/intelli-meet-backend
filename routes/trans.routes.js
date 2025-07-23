import express from 'express'
import { transcribe } from '../controllers/trans.controller.js'
const router = express.Router()
router.post('/transcribe', transcribe)
export default router