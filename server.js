// External dependencies 
const express = require('express');
const WebSocket = require("ws");
const cors = require('cors');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

// Middleware
const logger = require('./middleware/logger');

// Routes
const serviceRoutes = require('./routes/service');

// Models & Utils
const {JobRequest} = require('./models/jobRequest');
const {postOfferings} = require('./lib/postOfferings');
const { validatePreimage, validateCascdrUserEligibility } = require('./lib/authChecks');

// MongoDB connection with retry logic
const connectDB = async () => {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000
      });
      console.log('Connected to MongoDB');
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, err);
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Middleware setup
const corsOptions = {
  origin: ['https://cascdr.xyz', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  maxAge: 600,
  optionsSuccessStatus: 204
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

const timeoutMiddleware = (req, res, next) => {
  res.setTimeout(120000, () => {
    res.status(504).json({ error: 'Request timeout' });
  });
  next();
};

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
};

// App setup
const app = express();
require("dotenv").config();
global.WebSocket = WebSocket;

// Apply middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(timeoutMiddleware);
app.use(limiter);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.set('trust proxy', true);
app.use(logger);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Mount routes
app.use('/', serviceRoutes);

// Error handling
app.use(errorHandler);

// Initialize services
// postOfferings();
// setInterval(postOfferings, 300000);

// Server startup
const port = process.env.PORT || 6969;
const startServer = async () => {
  await connectDB();
  app.listen(port, () => {
    console.log("Starting NIP105 Server...");
    console.log(`Server started on port ${port}.`);
  });
};

startServer().catch(console.error);

module.exports = app;
