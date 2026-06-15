import express from 'express'
import {
  getMonthlyBalances,
  saveMonthlyBalance,
} from '../controllers/balanceController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', protect, getMonthlyBalances)
router.post('/', protect, saveMonthlyBalance)

export default router
