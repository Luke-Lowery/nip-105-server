// external dependencies
const express = require('express');
const WebSocket = require("ws");
const cors = require('cors');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');

// middleware
const logger = require('./middleware/logger');

// routes
const serviceRoutes = require('./routes/service');

// used for testing
const {JobRequest} = require('./models/jobRequest')
const {postOfferings} = require('./lib/postOfferings')
const { 
  validatePreimage, 
  validateCascdrUserEligibility 
} = require('./lib/authChecks');

// --------------------- MONGOOSE -----------------------------

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB!");
});

// --------------------- APP SETUP -----------------------------

const app = express();
require("dotenv").config();
global.WebSocket = WebSocket;


app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

app.use(bodyParser.json());
app.set('trust proxy', true); // trust first proxy

// Request Logging
app.use(logger);

// --------------------MOUNT ENDPOINT ROUTES -----------------------------

app.use('/', serviceRoutes);

postOfferings();
setInterval(postOfferings, 300000);


// --------------------- SERVER -----------------------------

let port = process.env.PORT;
if (port == null || port == "") {
  port = 6969;
}

app.listen(port, async function () {
  console.log("Starting NIP105 Stable Diffusion Server...");
  console.log(`Server started on port ${port}.`);
});
