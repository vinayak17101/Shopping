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
const encode = require('./models/encode')
const Cart = require('./models/cart')
const List = require('./models/list')

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
app.get('/home', auth, (req, res) => {
  res.render('home')
})

// Customer Recognition
app.get('/customer', auth, (req, res) => {
  res.render('customer')
})

// Billing Page
app.get('/billing', auth, (req, res) => {
  res.render('form')
})

app.post('/billing/:token', auth, upload.single('image'), async(req, res) => {
    await sharp(req.file.buffer).resize({width: 250, height: 250}).toFile('image.png')
    const imagePath = path.join(__dirname, '../image.png')
    const params = {
        imagesFile: [
          {
            data: fs.createReadStream(imagePath),
            contentType: 'image/jpeg',
          }
        ],
        collectionIds: ['663179e7-8856-4872-b255-75bdfc169b1a'],
        features: ['objects'],
      };
    fs.unlinkSync(imagePath)
    console.log('Ho')
    visualRecognition.analyze(params).then(response => {
        const objects = response.result.images[0].objects.collections[0].objects
        console.log(objects)
        res.render('form')
    }).catch(err => {
        console.log('error: ', err);
    })
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
      collectionIds: ['663179e7-8856-4872-b255-75bdfc169b1a'],
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
        price: item.price
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

app.post('/image', upload.single('image'), async(req, res) => {
  const pimage = await sharp(req.file.buffer).resize({width: 150, height: 150}).png().toBuffer()
  const pImage = new productInfo({
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
app.get('/customerImage', (req, res) => {
  res.render('customer-image')
})

app.post('/customerImage', upload.single('image'), async(req, res) => {
  const pimage = await sharp(req.file.buffer).resize({width: 150, height: 150}).png().toBuffer()
  const pImage = new productInfo({
    product: req.body.pname,
    image: pimage,
    email: req.body.email,
    credit: 0,
    debit: 0,
    loyalityPoints: 0
  })
  await pImage.save()
  res.render('add-image')
})