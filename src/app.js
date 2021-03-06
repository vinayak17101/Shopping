// Importing the required libraries
const path = require('path')
const fs = require('fs')
const express = require('express')
const hbs = require('hbs')
const multer = require('multer')
const sharp = require('sharp')
const cookieParser = require('cookie-parser')
var flash = require('express-flash')
const session = require('express-session')
const visualRecognition = require('./models/visual-recognition')
require('./db/mongoose')
const User = require('./models/user')
const auth = require('./middleware/auth')
const productInfo = require('./models/productInfo')
const Customer = require('./models/customer')
const encode = require('./models/encode')
const Cart = require('./models/cart')
const List = require('./models/list')
const Transaction = require('./models/transaction')

// Defining the class object
const upload = multer()
const app = express()

// Defining variables
const port = 3000
const publicDirectory = path.join(__dirname, '../public')
const viewDirectory = path.join(__dirname, '../templates/views')
const partialDirectory = path.join(__dirname, '../templates/partials')

// Setting up the directory
app.set('view engine', 'hbs')
app.set('views', viewDirectory)
hbs.registerPartials(partialDirectory)
app.use(express.static(publicDirectory))
app.use(express.json())
app.use(express.urlencoded({extended: false}))
app.use(cookieParser())
app.use(session({secret: 'thisisme', saveUninitialized: true, resave: true}))
app.use(flash())

// Startup Page
app.get('/', (req, res) => {
    res.render('startup')
})

// Signup Page
app.get('/signup', (req, res) => {
  res.render('signup')
})

app.post('/signup', async(req, res) => {
  const user = new User(req.body)
  try {
      await user.save()
      const token = await user.generateAuthToken()
      res.cookie('jwt', token, {maxAge: 2 * 60 * 60 * 1000})
      res.redirect("/home")
  } catch (e) {
    console.log(e)
      res.render('signup', {
        errorMessage: 'Account with same email id exists! Try with different one.'
      })
  }
})

// Login Page
app.get('/login', (req, res) => {
  try {
    auth
    res.redirect('/home')
  } catch {
    res.render('login')
  }
})

app.post('/login', async(req, res) => {
  try {
    const user = await User.findByCredentials(req.body.email, req.body.password)
    const token = await user.generateAuthToken()
    res.cookie('jwt', token,  {maxAge: 2 * 60 * 60 * 1000})
    res.redirect('/home')
  } catch (e) {
      res.render('login', {
        errorMessage: 'Provided credentials is not correct! Please try again.'
      })
  }
})

// Logout Page
app.get('/logout', auth, async (req, res) => {
  try {
      req.user.tokens = req.user.tokens.filter((token) => {
          return token.token !== req.token
      })
      await req.user.save()

      res.redirect('/')
  } catch (e) {
      res.status(500).send()
  }
})

// Home page
app.get('/home', auth, async(req, res) => {
  await req.user.populate({
    path: 'transactions',
    options: { sort: { 'createdAt' : -1} }
  }).execPopulate()
  const date = new Date()
  transactions = []
  var count = 0
  var dailyValue = 0
  for(const transaction of req.user.transactions) {
    if(date.getDate() == transaction.createdAt.getDate())
    {
      dailyValue += transaction.totalPrice
      count += 1
    } else {
      break
    }
  }
  var monthlyValue = 0
  for(const transaction of req.user.transactions) {
    if(date.getMonth() == transaction.createdAt.getMonth())
    {
      monthlyValue += transaction.totalPrice
    } else {
      break
    }
  }
  await req.user.populate({
    path: 'products'
  }).execPopulate()
  var lowInventory = 0
  for(products of req.user.products) {
    if(products.currentStock <= 10) {
      lowInventory += 1
    }
  }
  res.render('home', {
    dailyValue,
    monthlyValue, 
    count,
    lowInventory
  })
})

// Customer Recognition

app.get('/customer', auth, (req, res) => {
  res.render('customer')
})

app.post('/customer', auth, upload.single('image'), async(req, res) => {
  await sharp(req.file.buffer).resize({width: 150, height: 150}).toFile('image.png')
    const imagePath = path.join(__dirname, '../image.png')
    const params = {
        imagesFile: [
          {
            data: fs.createReadStream(imagePath),
            contentType: 'image/jpeg',
          }
        ],
        collectionIds: ['18425ce7-a4dc-4b55-8fb5-fb53b9f7f42b'],
        features: ['objects'],
      };
    const response = await visualRecognition.analyze(params)
    try {
    const objects = response.result.images[0].objects.collections[0].objects
    const ind = await Customer.findOne({name: objects[0].object})
    var bytes = new Uint8Array(ind.image.buffer);
    src = 'data:image/png;base64,'+encode(bytes)
    var individual = {
      name: ind.name,
      email: ind.email,
      credit: Math.round(ind.credit),
      debit: Math.round(ind.debit),
      loyalityPoints: Math.round(ind.loyalityPoints),
      image: src
    }
    req.session.customer = individual
    res.render('customer', individual)
    } catch(err) {
      console.log(err)
    }
})

var productsBill = []
var countBill = 0
var recommended = []

// Billing Page
app.get('/billing', auth, (req, res) => {
  var totalQty = 0
  if(req.session.cart) {
    const cart = new Cart(req.session.cart)
    totalQty = cart.totalQty
  }
  res.render('form', {
    productsBill,
    totalQty,
    recommended
  })
})

app.post('/billing', auth, upload.single('image'), async(req, res) => {
    await sharp(req.file.buffer).resize({width: 300, height: 300}).toFile('image.png')
    const imagePath = path.join(__dirname, '../image.png')
    const params = {
        imagesFile: [
          {
            data: fs.createReadStream(imagePath),
            contentType: 'image/jpeg',
          }
        ],
        collectionIds: ['6d6d95e8-0056-4363-a972-d617d6b81c4f'],
        features: ['objects']
      };
  const response = await visualRecognition.analyze(params)
  const objects = response.result.images[0].objects.collections[0].objects
  for (const comp of objects) {
    const item = await productInfo.findOne({product: comp.object})
    var rec;
    if(item.product === 'Hand-Sanitizer') {
      rec = await productInfo.findOne({product: 'Saundrya-Facewash'})
      var flag = false
      for(const elem of recommended) {
        if(elem.name == rec.product) {
          flag = true
          break
        } 
      }
      if(flag == false) {
        var bytes = new Uint8Array(rec.image.buffer);
        recSrc = 'data:image/png;base64,'+encode(bytes);
        recommended.push({
          id: rec.id,
          name: rec.product,
          price: rec.price,
          stock: rec.currentStock,
          index: countBill++,
          image: recSrc
        })
      }
    }
    if(item.product === 'Haldi-Chandan') {
      rec = await productInfo.findOne({product: 'Panchgavya'})
      var flag = false
      for(const elem of recommended) {
        if(elem.name == rec.product) {
          flag = true
          break
        } 
      }
      if(flag == false) {
        var bytes = new Uint8Array(rec.image.buffer);
        recSrc = 'data:image/png;base64,'+encode(bytes);
        recommended.push({
          id: rec.id,
          name: rec.product,
          price: rec.price,
          stock: rec.currentStock,
          index: countBill++,
          image: recSrc
        })
      }
    }
    if(item.product === 'Panchgavya') {
      rec = await productInfo.findOne({product: 'Haldi-Chandan'})
      var flag = false
      for(const elem of recommended) {
        if(elem.name == rec.product) {
          flag = true
          break
        } 
      }
      if(flag == false) {
        var bytes = new Uint8Array(rec.image.buffer);
        recSrc = 'data:image/png;base64,'+encode(bytes);
        recommended.push({
          id: rec.id,
          name: rec.product,
          price: rec.price,
          stock: rec.currentStock,
          index: countBill++,
          image: recSrc
        })
      }
    }
    if(item.product === 'Body-Lotion') {
      rec = await productInfo.findOne({product: 'Neem-Tulsi'})
      var flag = false
      for(const elem of recommended) {
        if(elem.name == rec.product) {
          flag = true
          break
        } 
      }
      if(flag == false) {
        var bytes = new Uint8Array(rec.image.buffer);
        recSrc = 'data:image/png;base64,'+encode(bytes);
        recommended.push({
          id: rec.id,
          name: rec.product,
          price: rec.price,
          stock: rec.currentStock,
          index: countBill++,
          image: recSrc
        })
      }
    }
    if(item.product === 'Neem-Tulsi') {
      rec = await productInfo.findOne({product: 'Body-Lotion'})
      var flag = false
      for(const elem of recommended) {
        if(elem.name == rec.product) {
          flag = true
          break
        } 
      }
      if(flag == false) {
        var bytes = new Uint8Array(rec.image.buffer);
        recSrc = 'data:image/png;base64,'+encode(bytes);
        recommended.push({
          id: rec.id,
          name: rec.product,
          price: rec.price,
          stock: rec.currentStock,
          index: countBill++,
          image: recSrc
        })
      }
    }
    if(item.product === 'Aastha-Dhoop') {
      rec = await productInfo.findOne({product: 'Haldi-Chandan'})
      var flag = false
      for(const elem of recommended) {
        if(elem.name == rec.product) {
          flag = true
          break
        } 
      }
      if(flag == false) {
        var bytes = new Uint8Array(rec.image.buffer);
        recSrc = 'data:image/png;base64,'+encode(bytes);
        recommended.push({
          id: rec.id,
          name: rec.product,
          price: rec.price,
          stock: rec.currentStock,
          index: countBill++,
          image: recSrc
        })
      }
    }
    var flag = true
    for (const c of productsBill) {
      if(c.id == item.id) {
        flag = false
      }
    }
    if(flag == true) {
      var bytes = new Uint8Array(item.image.buffer);
      src = 'data:image/png;base64,'+encode(bytes);
      productsBill.push({
        index: countBill++,
        id: item.id,
        name: item.product,
        image: src,
        price: item.price,
        stock: item.currentStock
      })
    } 
  }
  var totalQty = 0
  if(req.session.cart) {
    const cart = new Cart(req.session.cart)
    totalQty = cart.totalQty
  }
  res.render('form', {
    productsBill,
    totalQty,
    recommended
  })
})

app.get('/cart', auth, (req, res) => {
  if(!req.session.cart) {
    console.log(req.session.cart)
    req.session.totalPrice = undefined
    return res.render('cart')
  }
  var cart = new Cart(req.session.cart)
  const productsBill = cart.generateArray()
  var totalPrice = 0
  if(req.session.totalPrice) {
    totalPrice = req.session.totalPrice
  } else {
    for(const product of productsBill) {
      totalPrice += product.price
    }
  }
  req.session.totalPrice = totalPrice
  const customer = req.session.customer
  res.render('cart', {
    productsBill,
    totalPrice,
    customer
  })
})

app.get('/addtocart/:id', auth, (req, res) => {
  var productId = req.params.id;
  console.log(productId)
  var cart = new Cart(req.session.cart ? req.session.cart : {items: {}})
  productInfo.findById(productId, function(err, product) {
    if(err) {
      console.log('Error')
    }
    const qty = parseInt(req.query.qty)
    console.log(qty)
    cart.add(product, product.id, qty)
    req.session.cart = cart
    res.redirect('/billing')
  })
})

app.get('/removefromcart/:id', auth, (req, res) => {
  var productId = req.params.id;
  var cart = new Cart(req.session.cart)
  cart.remove(productId)
  req.session.cart = cart
  const customer = req.session.customer
  var totalPrice = 0
  var cart = new Cart(req.session.cart)
  const productsBill = cart.generateArray()
  for(const product of productsBill) {
    totalPrice += product.price
  }
  if(totalPrice === 0) {
    req.session.totalPrice = undefined
  }
  res.render('cart', {
    productsBill,
    customer,
    totalPrice
  })  
})

app.get('/finalbill', auth, async(req, res) => {
  var opt = req.query.opt
  var totalPrice = req.query.totalPrice
  const customer = await Customer.findOne({email: req.session.customer.email})
  if(opt == 'debit')
  {
    if(totalPrice <= customer.debit)
    {
      customer.debit -= totalPrice
      customer.debit = Math.round(customer.debit)
      await customer.save()
      res.redirect('/finalbill?opt=checkout')
    } else {
      totalPrice -= customer.debit
      customer.debit = 0
      await customer.save()
      req.session.customer.debit = 0
      req.session.totalPrice = Math.round(totalPrice)
      res.redirect('/cart')
    }
  }
  if(opt == 'addDebit')
  {
    const money = parseInt(req.query.money)
    if(customer.credit > 0)
    {
      if(customer.credit <= money)
      {
        customer.debit += money - customer.credit
        customer.credit = 0
        req.session.customer.credit = 0
        req.session.customer.debit = Math.round(customer.debit)
        await customer.save()
      } else {
        customer.credit -= money
        req.session.customer.credit = Math.round(customer.credit)
        customer.credit = Math.round(customer.credit)
        await customer.save()
      }
    } else {
      customer.debit += money
      customer.debit = Math.round(customer.debit)
      await customer.save()
      req.session.customer.debit = Math.round(req.session.customer.debit + money)
    }
    res.redirect('/cart')
  }
  if(opt == 'credit')
  {
    customer.credit += req.session.totalPrice
    customer.credit = Math.round(customer.credit)
    await customer.save()
    res.redirect('/finalbill?opt=checkout')
  }
  if(opt == 'loyality')
  {
    if(totalPrice <= customer.loyalityPoints)
    {
      customer.loyalityPoints -= totalPrice
      customer.loyalityPoints = Math.round(customer.loyalityPoints)
      await customer.save()
      res.redirect('/finalbill?opt=checkout')
    } else {
      totalPrice = Math.round(totalPrice - customer.loyalityPoints)
      customer.loyalityPoints = 0
      await customer.save()
      req.session.customer.loyalityPoints = 0
      req.session.totalPrice = totalPrice
      res.redirect('/cart')
    }
  }
  if(opt == 'checkout')
  {
    var cart = new Cart(req.session.cart)
    var items = []
    cart = cart.generateArray()
    var totalPrice = 0
    for(const item of cart) {
      const product = await productInfo.findOne({owner: req.user._id, product: item.item.product})
      if(product.currentStock < item.qty) {
        throw new Error('Stock not available!')
      }
      product.currentStock -= item.qty
      await product.save()
      items.push({
        product: item.item.product,
        qty: item.qty,
        price: item.price
      })
      totalPrice += item.price
    }
    const loyalityPoints = Math.round(req.session.totalPrice * 0.05)
    customer.loyalityPoints += loyalityPoints
    customer.bills += 1
    customer.value += req.session.totalPrice
    await customer.save()
    var transaction = new Transaction({
      owner: req.user._id,
      customer: req.session.customer.name,
      products: items,
      totalPrice
    })
    await transaction.save()
    req.session.totalPrice = undefined
    req.session.cart = undefined
    productsBill = []
    recommended = []
    res.redirect('/home')
  }
})

var products = []
var count = 0

// Add Product Page
app.get('/addproduct', auth, (req, res) => {
  var totalQty = 0
  if(req.session.list) {
    const list = new List(req.session.list)
    totalQty = list.totalQty
  }
  res.render('addproduct', {
    products,
    totalQty
  })
})

app.post('/addproduct', auth, upload.single('image'), async(req, res) => {
  await sharp(req.file.buffer).resize({width: 250, height: 250}).toFile('image.png')
  const imagePath = path.join(__dirname, '../image.png')
  const params = {
      imagesFile: [
        {
          data: fs.createReadStream(imagePath),
          contentType: 'image/jpeg',
        }
      ],
      collectionIds: ['6d6d95e8-0056-4363-a972-d617d6b81c4f'],
      features: ['objects'],
    };
  const response = await visualRecognition.analyze(params)
  const objects = response.result.images[0].objects.collections[0].objects
  for (const comp of objects) {
    const item = await productInfo.findOne({product: comp.object})
    var flag = true
    for (const c of products) {
      if(c.id == item.id) {
        flag = false
      }
    }
    if(flag == true) {
      var bytes = new Uint8Array(item.image.buffer);
      src = 'data:image/png;base64,'+encode(bytes);
      products.push({
        index: count++,
        id: item.id,
        name: item.product,
        image: src,
        price: item.price,
        stock: item.currentStock
      })
    } 
  }
  var totalQty = 0
  if(req.session.list) {
    const list = new List(req.session.list)
    totalQty = list.totalQty
  }
  res.render('addproduct', {
    products,
    totalQty
  })
})


// Add to list
app.get('/addtolist/:id', auth, (req, res) => {
  var productId = req.params.id;
  var list = new List(req.session.list ? req.session.list : {items: {}})
  productInfo.findById(productId, function(err, product) {
    if(err) {
      console.log('Error')
    }
    const qty = parseInt(req.query.qty)
    list.add(product, product.id, qty)
    req.session.list = list
    totalQty = req.session.list.totalQty
    res.redirect('/addproduct')
  })
})


// Remove from list
app.get('/removefromlist/:id', auth, (req, res) => {
  var productId = req.params.id;
  var list = new List(req.session.list)
  list.remove(productId)
  req.session.list = list
  res.render('list', {
    products: list.generateArray()
  })
})

// Update list
app.get('/updatestock', auth, (req, res) => {
  const list = new List(req.session.list)
  const listArray = list.generateArray()
  listArray.forEach(async (comp) => {
    const id = comp.item._id
    const product = await productInfo.findById(id)
    product.currentStock += comp.qty
    await product.save()
  })
  req.session.list = undefined
  products = []
  res.redirect('/home')
})

app.get('/list', auth, (req, res) => {
  if(!req.session.list) {
    return res.render('list')
  }
  var list = new List(req.session.list)
  const products = list.generateArray()
  res.render('list', {
    products
  })
})


// Add Product image
app.get('/image', (req, res) => {
  res.render('add-image')
})

app.post('/image', auth, upload.single('image'), async(req, res) => {
  const pimage = await sharp(req.file.buffer).resize({width: 150, height: 150}).png().toBuffer()
  const pImage = new productInfo({
    owner: req.user._id,
    product: req.body.pname,
    image: pimage,
    currentStock: 0,
    price: req.body.price
  })
  await pImage.save()
  res.render('add-image')
})


app.listen(port, () => {
    console.log('Server is up on port ', port)
})


// Add Customer Image
app.get('/customerImage', auth, (req, res) => {
  res.render('customer-image')
})

app.post('/customerImage', auth, upload.single('image'), async(req, res) => {
  const cimage = await sharp(req.file.buffer).resize({width: 350, height: 350}).png().toBuffer()
  const customer = new Customer({
    owner: req.user._id,
    name: req.body.pname,
    image: cimage,
    email: req.body.email,
    credit: 0,
    debit: 0,
    loyalityPoints: 0,
    bills: 0,
    value: 0
  })
  await customer.save()
  res.render('customer-image')
})


// View all customer
app.get('/viewcustomers', auth, async(req, res) => {
  await req.user.populate({
    path: 'customers'
  }).execPopulate()
  if(req.user.customers){
    var customers = []
    for(const customer of req.user.customers) {
      var bytes = new Uint8Array(customer.image.buffer);
      src = 'data:image/png;base64,'+encode(bytes);
      customers.push({
        name: customer.name,
        email: customer.email,
        bills: customer.bills,
        value: customer.value,
        loyalityPoints: customer.loyalityPoints,
        image: src
      })
  }
    res.render('viewcustomer', {
      customers 
    })
  }
})

// View Inventory
app.get('/inventoryreport', auth, async(req, res) => {
  await req.user.populate({
    path: 'products'
  }).execPopulate()
  if(req.user.products){
    var products = []
    for(const product of req.user.products) {
      var bytes = new Uint8Array(product.image.buffer);
      src = 'data:image/png;base64,'+encode(bytes);
      products.push({
        name: product.product,
        currentStock: product.currentStock,
        image: src,
        price: product.price
      })
  }
    res.render('inventory', {
      products 
    })
  }
})

// View Credit History
app.get('/credithistory', auth, async(req, res) => {
  await req.user.populate({
    path: 'customers'
  }).execPopulate()
  if(req.user.customers) {
    var creditCustomers = []
    for(const user of req.user.customers) {
      if(user.credit > 0) {
        var bytes = new Uint8Array(user.image.buffer);
        src = 'data:image/png;base64,'+encode(bytes);
        creditCustomers.push({
          name: user.name,
          email: user.email,
          image: src,
          credit: user.credit,
          value: user.value
        })
      }
    }
  }
  res.render('creditHistory', {
    creditCustomers
  })
})

// View Debit History
app.get('/debithistory', auth, async(req, res) => {
  await req.user.populate({
    path: 'customers'
  }).execPopulate()
  if(req.user.customers) {
    var debitCustomers = []
    for(const user of req.user.customers) {
      if(user.debit > 0) {
        var bytes = new Uint8Array(user.image.buffer);
        src = 'data:image/png;base64,'+encode(bytes);
        debitCustomers.push({
          name: user.name,
          email: user.email,
          image: src,
          debit: user.debit,
          value: user.value
        })
      }
    }
  }
  res.render('debitHistory', {
    debitCustomers
  })
})

// View Sales
app.get('/sales', auth, async(req, res) => {
  await req.user.populate({
    path: 'transactions',
    options: { sort: { 'createdAt' : -1} }
  }).execPopulate()
  if(req.user.transactions) {
    var transactions = []
    for(const transaction of req.user.transactions) {
      var parts = transaction.createdAt
      parts = new String(parts)
      parts = parts.split(' ')
      var date = parts[2] + '-' + parts[1] + '-' +parts[3]
      var time = parts[4]
      transactions.push({
        id: transaction._id,
        customer: transaction.customer,
        totalPrice: transaction.totalPrice,
        time: time,
        date: date
      })
    }
  }
  res.render('salesReport', {
    transactions
  })
})

// View basket
app.get('/viewbasket', auth, async(req, res) => {
  const id = req.query.id
  const transaction = await Transaction.findOne({owner: req.user._id, _id: id})
  const products = transaction.products
  res.render('basket', {
    products
  })
})

// Forecast Demands
app.get('/forecastdemand', auth, async(req, res) => {
  res.render('forecast')
})

app.post('/forecastdemand', auth, async(req, res) => {
  const item = await productInfo.findOne({product: req.body.product})
  await req.user.populate({
    path: 'transactions',
    options: { sort: { 'createdAt' : -1} }
  }).execPopulate()
  const date = new Date()
  transactions = []
  var count = 0
  setTimeout(() => {
    for(const transaction of req.user.transactions) {
      if(date.getDate() == transaction.createdAt.getDate() || date.getDate() == transaction.createdAt.getDate() - 1)
      {
        for(const product of transaction.products) {
          if(product.product === item.product) {
            count += product.qty
          }
        }
      } else {
        break
      }
    }
    const forecastFactor = Math.random() * (1.3 - 0.75) + 0.75
    var forecasted = Math.round(count * req.body.days * forecastFactor)
    if(forecasted === 0) {
      forecasted = Math.round(Math.round(Math.random() * (7 - 4) + 4) * req.body.days * forecastFactor)
    }
    var bytes = new Uint8Array(item.image.buffer);
    src = 'data:image/png;base64,'+encode(bytes);
    res.render('forecast', {
      name: item.product,
      image: src,
      price: item.price,
      stock: item.currentStock,
      forecasted,
      days: req.body.days
    })
  },6000)
})


// Contact Us
app.get('/contact', (req, res) => {
  res.render('contactus')
})

// User Profile 
app.get('/userprofile', auth, (req, res) => {
  if(req.user.avatar) {
    var bytes = new Uint8Array(req.user.avatar.buffer);
    var src = 'data:image/png;base64,'+encode(bytes)
  } else {
    var src = undefined
  }
  res.render('userprofile', {
    name: req.user.username,
    email: req.user.email,
    address: req.user.address,
    storeName: req.user.storeName,
    phone: req.user.phone,
    image: src
  })
})

app.get('/userprofile/edit', auth, (req, res) => {
  if(req.user.avatar) {
    var bytes = new Uint8Array(req.user.avatar.buffer);
    var src = 'data:image/png;base64,'+encode(bytes)
  } else {
    var src = undefined
  }
  res.render('edituserprofile', {
    name: req.user.username,
    email: req.user.email,
    address: req.user.address,
    storeName: req.user.storeName,
    phone: req.user.phone,
    image: src
  })
})

app.post('/userprofile/edit', auth, upload.single('image'), async(req, res) => {
  if(req.file) {
    var image = await sharp(req.file.buffer).resize({width: 350, height: 350}).png().toBuffer()
  } else {
    var image = req.user.avatar
  }
  if(req.body.storeName) {
    var storeName = req.body.storeName
  } else {
    var storeName = undefined
  }
  if(req.body.address) {
    var address = req.body.address
  } else {
    var address = undefined
  }
  if(req.body.phone) {
    var phone = req.body.phone
  } else {
    var phone = undefined
  }
  req.user.name = req.body.name
  req.user.avatar = image
  req.user.address = address
  req.user.storeName = storeName
  req.user.phone = phone
  const user = new User(req.user)
  await user.save()
  res.redirect('/userprofile')
})

app.get('/about', (req, res) => {
  res.render('aboutus')
})