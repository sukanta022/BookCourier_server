const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 3000

//middleware
app.use(cors())
app.use(express.json())


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

