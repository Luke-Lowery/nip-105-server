#!/bin/bash

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "Error: node is not installed or not in PATH"
    exit 1
fi

# Check if the bedrock-server.js file exists
if [ ! -f "bedrock-server.js" ]; then
    echo "Error: bedrock-server.js file not found in current directory"
    exit 1
fi

echo "Starting Bedrock server on PORT 3132..."
node bedrock-server.js

# The script will continue running until the server is stopped with Ctrl+C 