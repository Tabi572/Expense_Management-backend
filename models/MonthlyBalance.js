import mongoose from 'mongoose'

const monthlyBalanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    openingBalance: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
)

monthlyBalanceSchema.index({ user: 1, month: 1 }, { unique: true })

export default mongoose.model('MonthlyBalance', monthlyBalanceSchema)
