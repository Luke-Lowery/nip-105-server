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

// misc
const axios = require("axios");
const bolt11 = require("bolt11");
const { getBitcoinPrice } = require('./lib/bitcoinPrice');
const crypto = require('crypto');
const { sleep } = require("./lib/helpers");

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

// --------------------- ENDPOINTS -----------------------------

app.post("/:service", async (req, res) => {
  try {
    console.log("Rendering service:", req.params.service);
    console.log("full req:",req)
    const service = req.params.service;
    const invoice = await generateInvoice(service);
    const doc = await findJobRequestByPaymentHash(invoice.paymentHash);

    doc.requestData = req.body;
    doc.state = "NOT_PAID";
    await doc.save();

    logState(service, invoice.paymentHash, "REQUESTED");

    res.status(402).send(invoice);
  } catch (e) {
    console.log("Error rendering service invoice:")
    console.log(e.toString().substring(0, 150));
    res.status(500).send(e);
  }
});

app.get("/:service/:payment_hash/get_result", async (req, res) => {
  try {
    const service = req.params.service;
    const paymentHash = req.params.payment_hash;
    const { isPaid, invoice } = await getIsInvoicePaid(paymentHash);

    logState(service, paymentHash, "POLL");
    if (isPaid != true) {
      res.status(402).send({ ...invoice, isPaid });
    } else {
      const doc = await findJobRequestByPaymentHash(paymentHash);

      switch (doc.state) {
        case "WORKING":
          logState(service, paymentHash, "WORKING");
          res.status(202).send({ state: doc.state });
          break;
        case "ERROR":
        case "DONE":
          logState(service, paymentHash, doc.state);
          res.status(200).send(doc.requestResponse);
          break;
        default:
          logState(service, paymentHash, "PAID");
          const data = doc.requestData;
          submitService(service, data)
            .then(async (response) => {
              doc.requestResponse = response;
              doc.state = "DONE";
              console.log(`DONE ${service} ${paymentHash} ${response}`);
              await doc.save();
              if(service === "STABLE") res.status(200).send(response);
            })
            .catch(async (e) => {
              doc.requestResponse = e;
              doc.state = "ERROR";
              await doc.save();
            });

          if(service !== "STABLE"){
            doc.state = "WORKING";
            await doc.save();
            res.status(202).send({ state: doc.state });
          }
      }
    }
  } catch (e) {
    console.log(e.toString().substring(0, 300));
    res.status(500).send(e);
  }
});

app.get("/:service/:payment_hash/check_payment", async (req, res) => {
  try {
    const paymentHash = req.params.payment_hash;
    const { isPaid, invoice } = await getIsInvoicePaid(paymentHash);

    res.status(200).json({ invoice, isPaid });
  } catch (e) {
    console.log(e.toString().substring(0, 50));
    res.status(500).send(e);
  }
});

// --------------------- SERVICES -----------------------------

function usd_to_millisats(servicePriceUSD, bitcoinPrice) {
  const profitMarginFactor = 1.0 + process.env.PROFIT_MARGIN_PCT / 100.0;
  const rawValue = (servicePriceUSD * 100000000000 * profitMarginFactor) / bitcoinPrice;
  const roundedValue = Math.round(rawValue / 1000) * 1000; // Round to the nearest multiple of 1000
  return roundedValue;
}

async function getServicePrice(service) {
  const bitcoinPrice = await getBitcoinPrice(); 
  
  switch (service) {
    case "STABLE":
      return usd_to_millisats(process.env.STABLE_DIFFUSION_USD,bitcoinPrice);
    default:
      return process.env.GPT_MSATS;
  }
}

function submitService(service, data) {
  switch (service) {
    case "STABLE":
      return callStableDiffusion(data);
    default:
      return callStableDiffusion(data);
  }
}

async function callStableDiffusion(data) {
  const newData = {
    ...data,
    key: process.env.STABLE_DIFFUSION_API_KEY,
  };

  const config = {
    method: "post",
    url: "https://stablediffusionapi.com/api/v4/dreambooth",
    headers: {
      "Content-Type": "application/json",
    },
    data: newData,
  };

  const fetchConfig = {
    method: "post",
    url: "https://stablediffusionapi.com/api/v4/dreambooth/fetch",
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios(config);
    const fetchID = response.data.id;
    
    if(response.data.status === "processing"){
      fetchConfig['data'] = JSON.stringify({
        "key": process.env.STABLE_DIFFUSION_API_KEY,
        "request_id": fetchID,
      })
      let isProcessing = true;
      while (isProcessing) {
        await sleep(3000);
        const response = await axios(fetchConfig);
        console.log(JSON.stringify(response.data, null, 2));
        if (response.data.status !== "processing"){
          isProcessing = false;
          return response.data;
        }
      }
    }

    // Return when no longer processing
    return response.data;
  } catch (e) {
    console.log(`ERROR: ${e.toString().substring(0, 50)}`);
    return e;
  }
}

// postOfferings();
// setInterval(postOfferings, 300000);


// --------------------- SERVER -----------------------------

let port = process.env.PORT;
if (port == null || port == "") {
  port = 6969;
}

app.listen(port, async function () {
  console.log("Starting NIP105 Stable Diffusion Server...");
  console.log(`Server started on port ${port}.`);
});
