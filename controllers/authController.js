import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

/* ================= GENERATE TOKEN ================= */

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
    }
  )
}

/* ================= REGISTER ================= */

export const registerUser = async (req, res) => {
  try {
    const { name, email, username, password } = req.body

    // VALIDATION
    if (!name || !email || !username || !password) {
      return res.status(400).json({
        message: 'Please fill all fields',
      })
    }

    const normalizedUsername = username.trim().toLowerCase()

    // CHECK EXISTING USER
    const existingUser = await User.findOne({
      $or: [
        { email },
        { username: normalizedUsername },
      ],
    })

    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email or username',
      })
    }

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(
      password,
      10
    )

    // CREATE USER
    const user = await User.create({
      name,
      email,
      username: normalizedUsername,
      password: hashedPassword,
    })

    // RESPONSE
    res.status(201).json({
      message: 'User created successfully',

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
      },
    })

  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: 'Server error',
    })
  }
}

/* ================= LOGIN ================= */

export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body

    // VALIDATION
    if (!username || !password) {
      return res.status(400).json({
        message: 'Please fill all fields',
      })
    }

    const hasRegisteredUser = await User.exists({})

    if (!hasRegisteredUser) {
      return res.status(401).json({
        message: 'No registered users found',
      })
    }

    // FIND USER
    const user = await User.findOne({
      username: username.trim().toLowerCase(),
    })

    if (!user) {
      return res.status(401).json({
        message: 'User not found',
      })
    }

    /* ================= PASSWORD CHECK ================= */

    let isMatch = false

    // NORMAL BCRYPT USERS
    if (user.password.startsWith('$2')) {
      isMatch = await bcrypt.compare(
        password,
        user.password
      )
    }

    // OLD PLAIN TEXT USERS FIX
    else {
      isMatch = password === user.password

      // AUTO UPGRADE TO HASHED PASSWORD
      if (isMatch) {
        const newHashedPassword =
          await bcrypt.hash(password, 10)

        user.password = newHashedPassword
        await user.save()
      }
    }

    // INVALID PASSWORD
    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid credentials',
      })
    }

    // SUCCESS RESPONSE
    res.json({
      message: 'Login successful',

      token: generateToken(user._id),

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
      },
    })

  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: 'Server error',
    })
  }
}

/* ================= CURRENT USER ================= */

export const getCurrentUser = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      username: req.user.username,
    },
  })
}

/* ================= FORGOT PASSWORD ================= */

export const forgotPassword = async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        message: 'Please fill all fields',
      })
    }

    const user = await User.findOne({
      username: username.trim().toLowerCase(),
    })

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      })
    }

    user.password = await bcrypt.hash(password, 10)
    await user.save()

    return res.status(200).json({
      message: 'Password updated successfully',
    })
  } catch (error) {
    console.log(error)

    return res.status(500).json({
      message: 'Server error',
    })
  }
}
