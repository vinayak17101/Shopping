const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema({
    customer: {
        type: String,
        require: true
    },
    products: {
        type: Array,
        require: true
    }
}, {
    timestamps: true
})

const Transaction = mongoose.model('Transaction', transactionSchema)

module.exports = Transaction