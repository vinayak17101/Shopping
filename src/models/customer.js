const mongoose = require('mongoose')

const customerSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    name: {
        type: String,
        required: true
    },
    image: {
        type: Buffer
    },
    email: {
        type: String,
        unique: true, 
        required: true
    },
    loyalityPoints: {
        type: Number
    },
    credit: {
        type: Number
    },
    debit: {
        type: Number
    }
})

const Customer = mongoose.model('Customer', customerSchema)

module.exports = Customer