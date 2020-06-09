const mongoose = require('mongoose')

mongoose.connect('mongodb+srv://vinayak:Vinayak@02@cluster0-mcewp.mongodb.net/letsshop?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
})