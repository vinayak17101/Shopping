const mongoose = require('mongoose')

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    image: {
        type: Buffer
    },
    email: {
        type: String,
        unique: true, 
        require: true
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