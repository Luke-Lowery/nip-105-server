#!/bin/bash

# Set the base URL for the main server
BASE_URL="http://localhost:3000"

# Check if the server is running
echo "Checking if the main server is running..."
if ! curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/health | grep -q "200"; then
  echo "Error: Main server is not running or health endpoint is not responding."
  echo "Please start the server with 'npm run start-server' and ensure .env is properly configured."
  exit 1
else
  echo "Server is running ✅"
fi

# Make a request to the ChatGPT endpoint
echo -e "\nMaking a request to ChatGPT..."
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