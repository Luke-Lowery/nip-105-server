#!/bin/bash

# Set the base URL for the main server
PORT=${1:-3132}  # Default to 3132 if no port is provided
BASE_URL="http://localhost:${PORT}"

# Check if the server is running
echo "Checking if the server is running on port ${PORT}..."
if ! curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/health | grep -q "200"; then
  echo "Error: Server is not running or health endpoint is not responding on port ${PORT}."
  echo "Please start the server with 'node server.js' and ensure .env is properly configured."
  exit 1
else
  echo "Server is running ✅"
fi

# Test 1: Make a request to the ChatGPT endpoint
echo -e "\n1. Testing ChatGPT endpoint..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Tell me a short joke about programming."}
    ]
  }' \
  ${BASE_URL}/GPT

echo -e "\n\n"

# Test 2: Make a request to Bedrock
echo "2. Testing Bedrock endpoint..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is Amazon Bedrock?"}
    ],
    "stream": false
  }' \
  ${BASE_URL}/BEDROCK

echo -e "\n\n"

# Test 3: Testing with payment hash retrieval
echo "3. Testing response retrieval with payment hash (if available from previous request)..."
read -p "Enter payment hash from previous request (or press enter to skip): " PAYMENT_HASH
if [ ! -z "$PAYMENT_HASH" ]; then
  SERVICE_TYPE="BEDROCK"
  echo "Using service type: ${SERVICE_TYPE}"
  curl -X GET ${BASE_URL}/${SERVICE_TYPE}/${PAYMENT_HASH}/get_result
  echo -e "\n\n"
fi 