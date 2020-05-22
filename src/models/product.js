const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
    owner: {
        type: String, 
        requried: true
    },
    products: [{
        product: {
            type: String,
            required: true
        },
        stock: {
            type: Number
        }
    }]
}, {
    timestamps: true
})

const Product = mongoose.model('Product', productSchema)

module.exports = Product