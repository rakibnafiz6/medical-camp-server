require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
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
        await client.connect();

        const usersCollection = client.db("medicalDB").collection('users');
        const medicalCollection = client.db("medicalDB").collection('camps');
        const joinCollection = client.db("medicalDB").collection('join');

        // users related api

        // app.get('/organizer/:email', async(req, res)=>{
        //     const email = req.params.email;
        //     const query = {email}
        //     const cursor = usersCollection.find();
        //     const result = await cursor.toArray();
        //     res.send(result);
        // })


        app.post('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = req.body;

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
        app.get('/manage-camps', async (req, res) => {
            const cursor = medicalCollection.find()
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

        app.put('/camps-update/:id', async (req, res) => {
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

         const result = await medicalCollection.updateOne(filter, updateDoc,options)
         res.send(result);
        })

        app.post('/camps', async (req, res) => {
            const camps = req.body;
            const result = await medicalCollection.insertOne(camps)
            res.send(result);
        })

        // camp delete
        app.delete('/delete-camp/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
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


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
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
