import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const protect = async (req, res, next) => {
  try {
    let token

    // ================= CHECK TOKEN =================
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1]
    }

    // ================= NO TOKEN =================
    if (!token) {
      return res.status(401).json({
        message: 'Not authorized, no token',
      })
    }

    // ================= JWT SECRET CHECK =================
    if (!process.env.JWT_SECRET) {
      console.log('JWT_SECRET missing in .env')

      return res.status(500).json({
        message: 'JWT secret missing',
      })
    }

    // ================= VERIFY TOKEN =================
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    )

    // ================= FIND USER =================
    const user = await User.findById(decoded.id).select(
      '-password'
    )

    if (!user) {
      return res.status(401).json({
        message: 'User not found',
      })
    }

    // ================= ATTACH USER =================
    req.user = user

    next()

  } catch (error) {
    console.log('AUTH ERROR:', error)

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Session expired, please login again',
      })
    }

    return res.status(401).json({
      message: 'Invalid token, please login again',
    })
  }
}
