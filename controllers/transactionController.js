import MonthlyBalance from '../models/MonthlyBalance.js'
import Transaction from '../models/Transaction.js'

const toAmount = (value) => Number(value) || 0
const getMonth = (date) => String(date || '').slice(0, 7)

const sanitizeTransactionInput = ({
  date,
  description,
  debit,
  credit,
  category,
  note,
}) => ({
  date,
  description,
  debit: toAmount(debit),
  credit: toAmount(credit),
  category: category || 'Other',
  note: note || '',
})

const validateInput = (data) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(String(data.date || ''))) {
    return 'Please select a valid transaction date'
  }
  if (!String(data.description || '').trim()) return 'Description is required'
  if (data.debit < 0 || data.credit < 0) return 'Amounts cannot be negative'
  if (data.debit === 0 && data.credit === 0) return 'Enter a debit or credit amount'
  if (data.debit > 0 && data.credit > 0) {
    return 'Enter either debit or credit, not both'
  }
  return null
}

const validateMonthlyLedger = async (
  userId,
  month,
  candidate = null,
  excludeId = null
) => {
  const monthlyBalance = await MonthlyBalance.findOne({ user: userId, month })
  if (!monthlyBalance) {
    return {
      error: `Add a balance for ${month} before adding transactions`,
    }
  }

  const filter = {
    user: userId,
    date: { $regex: `^${month}` },
  }

  if (excludeId) filter._id = { $ne: excludeId }

  const transactions = await Transaction.find(filter).lean()

  if (candidate) transactions.push(candidate)

  transactions.sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date)
    if (dateDiff !== 0) return dateDiff
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  })

  let available = monthlyBalance.openingBalance

  for (const transaction of transactions) {
    available += toAmount(transaction.credit) - toAmount(transaction.debit)

    if (available < 0) {
      return {
        error: 'You have no more balance for this transaction date',
      }
    }
  }

  return { available }
}

const recalculateBalances = async (userId) => {
  const [transactions, balances] = await Promise.all([
    Transaction.find({ user: userId }).sort({ date: 1, createdAt: 1 }),
    MonthlyBalance.find({ user: userId }),
  ])

  const openingByMonth = new Map(
    balances.map((balance) => [balance.month, balance.openingBalance])
  )
  const runningByMonth = new Map()

  const updates = transactions.map((transaction) => {
    const month = getMonth(transaction.date)
    const current = runningByMonth.has(month)
      ? runningByMonth.get(month)
      : openingByMonth.get(month) || 0
    const balance =
      current + toAmount(transaction.credit) - toAmount(transaction.debit)

    runningByMonth.set(month, balance)

    return {
      updateOne: {
        filter: { _id: transaction._id, user: userId },
        update: { $set: { balance } },
      },
    }
  })

  if (updates.length > 0) await Transaction.bulkWrite(updates)
}

const ensureTransactionFitsBalance = async (
  userId,
  data,
  excludeId = null,
  createdAt = new Date()
) => {
  const month = getMonth(data.date)
  const result = await validateMonthlyLedger(
    userId,
    month,
    {
      ...data,
      createdAt,
    },
    excludeId
  )

  return result.error || null
}

export const getTransactions = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const skip = (page - 1) * limit

    await recalculateBalances(req.user._id)

    const [transactions, totalTransactions] = await Promise.all([
      Transaction.find({ user: req.user._id })
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments({ user: req.user._id }),
    ])

    return res.status(200).json({
      transactions,
      currentPage: page,
      totalPages: Math.ceil(totalTransactions / limit),
      totalTransactions,
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const addTransaction = async (req, res) => {
  try {
    const data = sanitizeTransactionInput(req.body)
    const inputError = validateInput(data)
    if (inputError) return res.status(400).json({ message: inputError })

    const balanceError = await ensureTransactionFitsBalance(req.user._id, data)
    if (balanceError) return res.status(400).json({ message: balanceError })

    const transaction = await Transaction.create({
      user: req.user._id,
      ...data,
    })

    await recalculateBalances(req.user._id)

    return res.status(201).json(await Transaction.findById(transaction._id))
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}

export const updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    })

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' })
    }

    const data = sanitizeTransactionInput(req.body)
    const inputError = validateInput(data)
    if (inputError) return res.status(400).json({ message: inputError })

    const balanceError = await ensureTransactionFitsBalance(
      req.user._id,
      data,
      transaction._id,
      transaction.createdAt
    )
    if (balanceError) return res.status(400).json({ message: balanceError })

    Object.assign(transaction, data)
    await transaction.save()
    await recalculateBalances(req.user._id)

    return res.status(200).json(await Transaction.findById(transaction._id))
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}

export const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    })

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' })
    }

    const ledgerResult = await validateMonthlyLedger(
      req.user._id,
      getMonth(transaction.date),
      null,
      transaction._id
    )

    if (ledgerResult.error) {
      return res.status(400).json({
        message: 'Cannot delete this credit because later debits depend on it',
      })
    }

    await transaction.deleteOne()
    await recalculateBalances(req.user._id)

    return res.status(200).json({ message: 'Deleted successfully' })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}
