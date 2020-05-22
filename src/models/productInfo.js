const mongoose = require('mongoose')

const productInfoSchema = new mongoose.Schema({
    product: {
        type: String,
        require: true,
        unique: true,
        trim: true
    },
    image: {
        type: Buffer
    },
    currentStock: {
        type: Number,
        require: true
    }, 
    price: {
        type: Number,
        require: true
    }
})

const productInfo = mongoose.model('Product Info', productInfoSchema)

module.exports = productInfo