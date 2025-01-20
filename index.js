require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xd8r6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // await client.connect();

        const usersCollection = client.db("medicalDB").collection('users');
        const medicalCollection = client.db("medicalDB").collection('camps');
        const joinCollection = client.db("medicalDB").collection('join');
        const paymentCollection = client.db("medicalDB").collection('payment');
        const feedbackCollection = client.db("medicalDB").collection('feedback');

        // jwt related api
        app.post('/jwt', async(req, res)=>{
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
                expiresIn: '1d'});
                res.send({token});
        })

        // middlewares
        const verifyToken = (req, res, next)=>{
            if(!req.headers.authorization){
                return res.status(401).send({message: 'unauthorized access'});
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded)=>{
                if(err){
                    return res.status(401).send({message: 'unauthorized access'});
                }
                req.decoded = decoded;
                next();
            })
        }




        // users related api
        app.get('/participant-profile/:email', async(req, res)=>{
            const email = req.params.email;
            const query = {email}
            const result = await usersCollection.findOne(query);
            res.send(result);
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }

            const isExist = await usersCollection.findOne(query);
            if (isExist) {
                return res.send({ message: 'user already exist database' });
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // medical-camps related api
        app.get('/camps', async (req, res) => {
            const search = req.query.search;
            const sort = req.query.sort;
            let sortCriteria = {};

            if (sort === 'Most Registered') {
                sortCriteria = { participantCount: -1 }
            }
            else if (sort === 'Camp Fees') {
                sortCriteria = { fees: 1 }
            } else if (sort === 'Alphabetical Order') {
                sortCriteria = { campName: 1 }
            }


            const cursor = medicalCollection.find({
                $or: [
                    { campName: { $regex: search, $options: 'i' } },
                    { location: { $regex: search, $options: 'i' } },
                    { dateTime: { $regex: search, $options: 'i' } },
                ],
            }).sort(sortCriteria);
            const result = await cursor.toArray();
            res.send(result);
        })


        // camp-details
        app.get('/camps-details/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await medicalCollection.findOne(query)
            res.send(result);
        })

        // highs participant
        app.get('/high-participant', async (req, res) => {
            const cursor = medicalCollection.find().sort({ participantCount: -1 }).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        })

        // organizer manage camps
        app.get('/manage-camps', verifyToken, async (req, res) => {
            const search = req.query.search || '';
            const query = {
                $or: [
                    { campName: { $regex: search, $options: 'i' } },
                    { dateTime: { $regex: search, $options: 'i' } },
                    { professionalName: { $regex: search, $options: 'i' } },
                ]
            }
            const cursor = medicalCollection.find(query)
            const result = await cursor.toArray()
            res.send(result);
        })

        // manage camps update
        app.get('/update-camps/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await medicalCollection.findOne(query)
            res.send(result);
        })

        app.put('/camps-update/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const campData = req.body;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    campName: campData.campName,
                    dateTime: campData.dateTime,
                    description: campData.description,
                    fees: campData.fees,
                    image: campData.image,
                    location: campData.location,
                    participantCount: campData.participantCount,
                    professionalName: campData.professionalName,
                }
            }

            const result = await medicalCollection.updateOne(filter, updateDoc, options)
            res.send(result);
        })

        app.post('/camps', verifyToken, async (req, res) => {
            const camps = req.body;
            const result = await medicalCollection.insertOne(camps)
            res.send(result);
        })

        // camp delete
        app.delete('/delete-camp/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await medicalCollection.deleteOne(query)
            res.send(result);
        })

        // join related api
        app.post('/joins', async (req, res) => {
            const joinUser = req.body;
            const result = await joinCollection.insertOne(joinUser)

            const filter = { _id: new ObjectId(joinUser.id) }
            const update = { $inc: { participantCount: 1 } }
            const updateParticipantCount = await medicalCollection.updateOne(filter, update)

            res.send(result);
        })

        // register camps
        app.get('/register/:email', async (req, res) => {
            const email = req.params.email;
            const search = req.query.search;
            const query = { participantEmail: email,
                $or: [
                    { campName: { $regex: search, $options: 'i' } },
                    { campFees: { $regex: search, $options: 'i' } },
                    { paymentStatus: { $regex: search, $options: 'i' } },
                ]
             }
            const result = await joinCollection.find(query).toArray();
            res.send(result);
        })

        // analytics api
        app.get('/analytics/:email', async (req, res) => {
            const email = req.params.email;
            const query = { participantEmail: email }
            const result = await joinCollection.find(query).toArray();
            res.send(result);
        })

        // manage register
        app.get('/manage-register', async(req, res)=>{
            const search = req.query.search || '';
            const query = {
                $or: [
                    { campName: { $regex: search, $options: 'i' } },
                    { campFees: { $regex: search, $options: 'i' } },
                    { paymentStatus: { $regex: search, $options: 'i' } },
                ]
            }
            const cursor = joinCollection.find(query)
            const result = await cursor.toArray();
            res.send(result);
        })

        // manage register confirmationStatus update
        app.patch('/confirmation-status/:id', async(req, res)=>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
            const query = {id: id}
            const updateConfirmation ={
                $set:{
                    confirmationStatus: "Confirmed",
                }
            }

            const result = await joinCollection.updateOne(filter, updateConfirmation)
            const paymentConfirmation = await paymentCollection.updateOne(query, updateConfirmation)
            res.send({result, paymentConfirmation});
        })

        // registration cancel organizer
        app.delete('/delete-register/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const filter = {id: id}
            const result = await joinCollection.deleteOne(query)
            const payDelete = await paymentCollection.deleteOne(filter)
            res.send({result, payDelete});
        })

        app.delete('/register/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await joinCollection.deleteOne(query)
            res.send(result);
        })

        // payment related api
        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { fees } = req.body;

            if (!fees) {
                return res.status(400).send({ error: "Fees is required!" });
            }

            const amount = parseInt(fees * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: 'usd',
                payment_method_types: ['card'],
            });

            res.send({ clientSecret: paymentIntent.client_secret });
        });

        // payment status update
        app.post('/update-payment-status/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const joinData = await joinCollection.findOne(filter);

            const updateDoc = {
                $set: {
                    paymentStatus: "paid",
                }
            }
            const result = await joinCollection.updateOne(filter, updateDoc)

            const paymentDetails = {
                campName: joinData.campName,
                campFees: joinData.campFees,
                paymentStatus: "paid",
                confirmationStatus: joinData.confirmationStatus,
                transactionId: req.body.transactionId,
                email: req.body.email,
                id: id,
            };
            const paymentResult = await paymentCollection.insertOne(paymentDetails);



            res.send({result, paymentResult});

        })

        // payment history
        app.get('/payment-history/:email', async(req, res)=>{
            const email = req.params.email;
            const search = req.query.search;
            const query = {email,
                $or: [
                    { campName: { $regex: search, $options: 'i' } },
                    { campFees: { $regex: search, $options: 'i' } },
                    { paymentStatus: { $regex: search, $options: 'i' } },
                ]
            }
            const cursor = paymentCollection.find(query)
            const result = await cursor.toArray();
            res.send(result);
        })

        // feedback related apii
        app.post('/feedbacks', async(req, res)=>{
            const feedbackData = req.body;
            const result = await feedbackCollection.insertOne(feedbackData)
            res.send(result);
        })

        app.get('/feedback-rating', async(req, res)=>{
            const cursor = feedbackCollection.find()
            const result = await cursor.toArray()
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('medical camp is running');
})

app.listen(port, () => {
    console.log(`medical camp is running on port: ${port}`);
})
