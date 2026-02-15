const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const app = express()
const port = process.env.PORT || 3000


const admin = require("firebase-admin");

const serviceAccount = require("./bookcouriar-firebase-adminsdk-fbsvc-39bd445182.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



//middleware
app.use(cors())
app.use(express.json())


const verifyFireBaseToken = async (req, res, next) => {
  console.log("In the verify middleware", req.headers.authorization)
  if (!req.headers.authorization) {
    //do not allow to go
    return res.status(401).send({ message: 'Unauthorized access' })
  }
  const token = req.headers.authorization.split(' ')[1];
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized access' })
  }
  //verify token
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.token_email = decoded.email
    next();
  }
  catch {
    console.log("Invalid token")
    return res.status(401).send({ message: 'Unauthorized access' })
  }

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2q9t7lj.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const database = client.db('bookCouriar_db')
    const userCollection = database.collection('users')
    const bookCollection = database.collection('books')
    const cartCollection = database.collection('cart')

    //users api
    app.post('/users', async (req, res) => {
      try {
        const newUser = req.body;
        const userEmail = newUser.email;

        const query = { email: userEmail };
        const isEmailExist = await userCollection.findOne(query);

        if (isEmailExist) {
          return res.status(409).send({ message: "User already exists" });
        }

        newUser.role = 'user';
        newUser.createdAt = new Date();

        const result = await userCollection.insertOne(newUser);
        res.send(result);

      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error", error });
      }
    });

    app.get('/users', verifyFireBaseToken, async (req, res) => {
      const query = {}
      const cursour = userCollection.find(query)
      const result = await cursour.toArray()
      res.send(result)

    })

    app.get('/users/:email', async (req, res) => {
      try {
        const userEmail = req.params.email
        const query = { email: userEmail }

        const result = await userCollection.findOne(query)

        if (!result) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send(result)
      }
      catch (error) {
        res.status(500).send({
          message: "Failed to fetch user",
          error: error.message
        });
      }
    })


    app.patch('/users/:email', async (req, res) => {
      const userEmail = req.params.email
      const query = { email: userEmail }

      const updateProfile = req.body
      const update = {
        $set: {
          name: updateProfile.name,
          photo: updateProfile.photo
        }
      }
      const result = await userCollection.updateOne(query, update)
      res.send(result)


    })

    app.delete('/users/:email', verifyFireBaseToken, async (req, res) => {
      const mail = req.params.email
      if (mail) {
        if (mail != req.token_email) {
          return;
        }
      }
      const query1 = { email: mail }
      const query2 = { userEmail: mail }

      const result1 = await userCollection.deleteOne(query1)
      const result2 = await cartCollection.deleteOne(query2)

      res.send({
        success: true,
        userDeleted: result1.deletedCount,
        cartsDeleted: result2.deletedCount,
        message: "User and related carts deleted successfully"
      });
    })

    app.get('/users/:email/role', async (req, res) => {
      const email = req.params.email;
      const query = { email }
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || 'user' })
    })

    app.patch('/users/role/:email', verifyFireBaseToken, async (req, res) => {
      const email = req.params.email
      const { role } = req.body

      const result = await userCollection.updateOne({ email }, { $set: { role } })
      res.send(result)
    })



    //books API
    app.post('/books', verifyFireBaseToken, async (req, res) => {
      const librarianEmail = req.query.email

      if (librarianEmail) {
        if (librarianEmail != req.token_email) {
          return;
        }
      }

      const newBooks = req.body
      newBooks.createdAt = new Date()

      const result = await bookCollection.insertOne(newBooks)
      res.send(result)
    })

    app.get('/books', async (req, res) => {
      const cursour = bookCollection.find()
      const result = await cursour.toArray()
      res.send(result)
    })

    app.patch('/books/:id', verifyFireBaseToken, async (req, res) => {
      const librarianEmail = req.query.email;

      if (librarianEmail && librarianEmail !== req.token_email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateBook = req.body;

      const update = {
        $set: {
          title: updateBook.title,
          author: updateBook.author,
          description: updateBook.description,
          price: updateBook.price,
          status: updateBook.status,
          quantity: updateBook.quantity,
          photo: updateBook.photo
        }
      };

      const result = await bookCollection.updateOne(query, update);
      res.send(result);
    });

    //cart api
    app.post('/carts', verifyFireBaseToken, async (req, res) => {
      const cartEmail = req.query.email;

      if (cartEmail) {
        if (cartEmail != req.token_email) {
          return res.status(403).send({ message: "Forbidden access" });
        }
      }

      const newCart = req.body
      newCart.createdAt = new Date()
      newCart.transectionID = "";
      newCart.invoice = "no"
      const result = await cartCollection.insertOne(newCart)
      res.send(result)
    })

    app.get('/carts/:email', verifyFireBaseToken, async (req, res) => {
      const cartEmail = req.params.email;

      if (cartEmail !== req.token_email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const query = { userEmail: cartEmail };
      const cursor = cartCollection.find(query);
      const result = await cursor.toArray();

      res.send(result);
    });

    app.delete("/carts/:id", verifyFireBaseToken, async (req, res) => {
      const cartEmail = req.query.email;

      if (cartEmail !== req.token_email) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const id = req.params.id;
      const result = await cartCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //payment api
    app.post('/payment-checkout-session', verifyFireBaseToken, async (req, res) => {

      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: amount,
              product_data: {
                name: `Please pay for: ${paymentInfo.bookName}`
              }
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        metadata: {
          cartID: paymentInfo.cartID,
        },
        customer_email: paymentInfo.senderEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/carts`,
      })

      res.send({ url: session.url })
    })

    app.patch('/payment-success', async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        if (!sessionId) {
          return res.status(400).json({ message: "Session ID missing" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        console.log('session retrieve', session);

        let result = null;

        if (session.payment_status === 'paid') {
          const id = session.metadata.cartID;
          const query = { _id: new ObjectId(id) };

          const update = {
            $set: {
              transectionID: session.payment_intent,
              invoice: "pending",
              status: "paid"
            }
          };

          result = await cartCollection.updateOne(query, update);
        }

        res.status(200).json({
          success: true,
          payment_status: session.payment_status,
          sessionId,
          dbUpdate: result
        });

      } catch (err) {
        console.error("Stripe error:", err.message);
        res.status(500).json({ success: false, message: "Stripe session failed" });
      }
    });

    //invoice api
    app.get('/pending-invoices', async (req, res) => {
      const result = await cartCollection.find({ invoice: "pending" }).sort({ createdAt: -1 }).toArray();

      res.send(result);
    });

    app.patch('/accept-invoice/:id', verifyFireBaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const update = {
        $set: {
          invoice: "approved",
          status: "paid"
        }
      };

      const result = await cartCollection.updateOne(query, update);
      res.send(result);
    });

    app.get('/my-invoices', verifyFireBaseToken, async (req, res) => {

      const email = req.query.email;
      if (email) {
        if (email != req.token_email) {
          return res.status(403).send({ message: "Forbidden access" });
        }
      }
      const result = await cartCollection.find({
        userEmail: email, invoice: "approved"
      }).sort({ createdAt: -1 }).toArray();

      res.send(result);
    });


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

