const express = require('express');
const WebSocket = require("ws");
const cors = require('cors');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const logger = require('./middleware/logger');
const serviceRoutes = require('./routes/service');
const {JobRequest} = require('./models/jobRequest');
const {postOfferings} = require('./lib/postOfferings');
const { validatePreimage, validateCascdrUserEligibility } = require('./lib/authChecks');

// MongoDB connection with retry logic
const connectDB = async () => {
  const maxRetries = 5;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000
      });
      console.log('Connected to MongoDB');
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, err);
      lastError = err;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  throw lastError;
};

// Enhanced CORS configuration for Brave compatibility
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = ['https://cascdr.xyz', 'http://localhost:3000'];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Content-Type-Options'],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

// Timeout middleware
const timeoutMiddleware = (req, res, next) => {
  res.setTimeout(120000, () => {
    res.status(504).json({ 
      error: 'Request timeout',
      message: 'The request took too long to process'
    });
  });
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: {
      status,
      message,
      timestamp: new Date().toISOString(),
      path: req.path
    }
  });
};

// App setup
const app = express();
require("dotenv").config();
global.WebSocket = WebSocket;

// CORS headers middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', true);
  res.header('X-Content-Type-Options', 'nosniff');
  next();
});

// Apply middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(timeoutMiddleware);
app.use(limiter);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.set('trust proxy', true);
app.use(logger);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ 
      status: 'healthy',
      mongodb: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      mongodb: 'disconnected',
      error: error.message
    });
  }
});

// Mount routes
app.use('/', serviceRoutes);

// Error handling
app.use(errorHandler);

// Initialize services
postOfferings();
setInterval(postOfferings, 300000);

// Server startup with graceful shutdown
const port = process.env.PORT || 6969;
let server;

const startServer = async () => {
  try {
    await connectDB();
    server = app.listen(port, () => {
      console.log("Starting NIP105 Server...");
      console.log(`Server started on port ${port}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down gracefully...');
      server.close(async () => {
        try {
          await mongoose.connection.close();
          console.log('MongoDB connection closed');
          process.exit(0);
        } catch (err) {
          console.error('Error during shutdown:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;