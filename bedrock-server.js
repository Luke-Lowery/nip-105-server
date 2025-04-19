const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const setupBedrockRoutes = require("./routes/bedrock");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configure and set up the Bedrock routes
const bedrockConfig = {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  modelId: process.env.BEDROCK_MODEL_ID || "us.deepseek.r1-v1:0",
  maxTokens: parseInt(process.env.BEDROCK_MAX_TOKENS || "1000")
};

setupBedrockRoutes(app, bedrockConfig);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'bedrock' });
});

// Use PORT from environment (3132 in your case)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Bedrock server running on port ${PORT}`);
});

module.exports = app; 