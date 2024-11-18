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

require("dotenv").config();
global.WebSocket = WebSocket;

const app = express();

// CORS setup must be first
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://cascdr.xyz');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.header('X-Content-Type-Options', 'nosniff');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});

// Basic middleware
app.use(limiter);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.set('trust proxy', true);
app.use(logger);

// MongoDB setup
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'healthy' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy' });
  }
});

// Routes
app.use('/', serviceRoutes);

// Initialize services
// postOfferings();
// setInterval(postOfferings, 300000);

// Start server
const port = process.env.PORT || 6969;
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    // Graceful shutdown
    ['SIGTERM', 'SIGINT'].forEach(signal => {
      process.on(signal, () => {
        console.log('Shutting down...');
        server.close(async () => {
          await mongoose.connection.close();
          process.exit(0);
        });
      });
    });

  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;