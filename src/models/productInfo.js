const mongoose = require('mongoose')

const productInfoSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    product: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: Buffer
    },
    currentStock: {
        type: Number,
        required: true
    }, 
    price: {
        type: Number,
        required: true
    }
})

const productInfo = mongoose.model('Product Info', productInfoSchema)

module.exports = productInfo