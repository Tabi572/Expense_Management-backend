import MonthlyBalance from '../models/MonthlyBalance.js'
import Transaction from '../models/Transaction.js'

const getMonthSummary = async (userId, monthlyBalance) => {
  const totals = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        date: { $regex: `^${monthlyBalance.month}` },
      },
    },
    {
      $group: {
        _id: null,
        totalDebit: { $sum: '$debit' },
        totalCredit: { $sum: '$credit' },
      },
    },
  ])

  const totalDebit = totals[0]?.totalDebit || 0
  const totalCredit = totals[0]?.totalCredit || 0

  return {
    ...monthlyBalance.toObject(),
    totalDebit,
    totalCredit,
    availableBalance:
      monthlyBalance.openingBalance + totalCredit - totalDebit,
  }
}

export const getMonthlyBalances = async (req, res) => {
  try {
    const balances = await MonthlyBalance.find({ user: req.user._id }).sort({
      month: -1,
    })

    const summaries = await Promise.all(
      balances.map((balance) => getMonthSummary(req.user._id, balance))
    )

    return res.status(200).json({ balances: summaries })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const saveMonthlyBalance = async (req, res) => {
  try {
    const month = String(req.body.month || '').trim()
    const openingBalance = Number(req.body.openingBalance)

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ message: 'Please select a valid month' })
    }

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      return res.status(400).json({
        message: 'Opening balance must be zero or greater',
      })
    }

    const existing = await MonthlyBalance.findOne({
      user: req.user._id,
      month,
    })

    const transactions = await Transaction.find({
      user: req.user._id,
      date: { $regex: `^${month}` },
    }).sort({ date: 1, createdAt: 1 })

    let runningChange = 0
    let minimumRequired = 0

    transactions.forEach((transaction) => {
      runningChange += transaction.credit - transaction.debit
      minimumRequired = Math.max(minimumRequired, -runningChange)
    })

    if (openingBalance < minimumRequired) {
      return res.status(400).json({
        message: `Balance cannot be less than Rs ${minimumRequired.toLocaleString()} because transactions already use this amount`,
      })
    }

    const balance = existing || new MonthlyBalance({ user: req.user._id, month })
    balance.openingBalance = openingBalance
    await balance.save()

    return res.status(existing ? 200 : 201).json(
      await getMonthSummary(req.user._id, balance)
    )
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}
