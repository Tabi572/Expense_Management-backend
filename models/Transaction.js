import mongoose from 'mongoose'

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    debit: {
      type: Number,
      default: 0,
    },

    credit: {
      type: Number,
      default: 0,
    },

    balance: {
      type: Number,
      default: 0,
    },

    category: {
      type: String,
      default: 'Other',
    },

    note: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
)

const Transaction = mongoose.model('Transaction', transactionSchema)

export default Transaction
