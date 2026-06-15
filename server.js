import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import connectDB from './config/db.js'
import transactionRoutes from './routes/transactionRoutes.js'
import authRoutes from './routes/authRoutes.js'
import balanceRoutes from './routes/balanceRoutes.js'

// Load env
dotenv.config()

const app = express()

/* ================= MIDDLEWARE ================= */

// CORS FIX (more stable for frontend + localhost dev)
app.use(
  cors({
    origin: 'http://localhost:5173', // adjust if needed (Vite default)
    credentials: true,
  })
)

app.use(express.json())

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

/* ================= ROUTES ================= */

app.get('/', (req, res) => {
  res.send('API Running...')
})

app.use('/api/auth', authRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/balances', balanceRoutes)

/* ================= ERROR HANDLING ================= */

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

/* ================= SERVER ================= */

const startServer = async () => {
  await connectDB()

  const PORT = process.env.PORT || 5000

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

startServer()
