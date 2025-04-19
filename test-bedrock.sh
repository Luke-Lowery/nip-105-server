#!/bin/bash

# Set the base URL for the Bedrock server
BASE_URL="http://localhost:3132"

# Check if the server is running
echo "Checking if the Bedrock server is running..."
if ! curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/health | grep -q "200"; then
  echo "Error: Server is not running or health endpoint is not responding."
  echo "Please start the server with 'npm run start-bedrock' and ensure .env is properly configured."
  exit 1
else
  echo "Server is running ✅"
fi

# Non-streaming request
echo -e "\nMaking a non-streaming request to Bedrock..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is Amazon Bedrock?"}
    ],
    "stream": false
  }' \
  ${BASE_URL}/bedrock/query

echo -e "\n\n"

# Estimate cost
echo "Estimating cost..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "inputTokens": 500,
    "outputTokens": 1000
  }' \
  ${BASE_URL}/bedrock/estimate-cost

echo -e "\n\n"

# Streaming request (this will output the SSE stream)
echo "Making a streaming request to Bedrock (press Ctrl+C to stop)..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Write a short poem about AI"}
    ],
    "stream": true
  }' \
  ${BASE_URL}/bedrock/query