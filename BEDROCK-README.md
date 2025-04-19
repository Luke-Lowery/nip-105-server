# Bedrock Service for NIP-105 Server

This implementation adds Amazon Bedrock support to the NIP-105 server, specifically for accessing the DeepSeek R1 model.

## Setup

1. Make sure you have AWS credentials with access to Bedrock and specifically the DeepSeek model.

2. Configure your `.env` file with the following Bedrock-specific variables (you can copy from `.env.example`):

```
# AWS Credentials
AWS_REGION = us-west-2  # Or your preferred region where Bedrock is available
AWS_ACCESS_KEY_ID = YOUR_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY = YOUR_SECRET_ACCESS_KEY

# Bedrock Model ID (default: us.deepseek.r1-v1:0)
BEDROCK_MODEL_ID = us.deepseek.r1-v1:0

# Bedrock Max Tokens
BEDROCK_MAX_TOKENS = 1000

# Bedrock Server Port (if different than main server)
BEDROCK_PORT = 3001

# Bedrock pricing in USD and MSATS
BEDROCK_USD = 0.01
BEDROCK_MSATS = 1000
```

## Running the Server

You can run the Bedrock server as a standalone service or integrate it with the main NIP-105 server.

### Standalone Bedrock Server

Run the following command:

```bash
npm run start-bedrock
```

This will start the Bedrock server on the port specified in your `.env` file (default: 3001).

### Integrated with Main Server

The Bedrock functionality is also integrated with the main NIP-105 service. When you run the main server:

```bash
npm run start-server
```

The Bedrock service will be available through the regular service endpoints:

- `/BEDROCK` for the main service
- `/BEDROCK/:payment_hash/get_result` for retrieving results

## Testing

You can test the Bedrock implementation using the provided test script:

```bash
npm run test-bedrock
```

This will test both streaming and non-streaming API calls to ensure everything is working as expected.

## API Endpoints

### Direct Bedrock Endpoints (Standalone Server)

- **POST /bedrock/query**: Send queries to the Bedrock model
  - Body:
    ```json
    {
      "messages": [
        {"role": "system", "content": "Optional system prompt"},
        {"role": "user", "content": "Your question here"}
      ],
      "stream": true/false,
      "maxTokens": 1000
    }
    ```

- **POST /bedrock/estimate-cost**: Estimate the cost of a request
  - Body:
    ```json
    {
      "inputTokens": 500,
      "outputTokens": 1000
    }
    ```

### NIP-105 Service Endpoints

When using the Bedrock service through the main NIP-105 server:

- **POST /BEDROCK**: Submit a request to the Bedrock service
  - Body:
    ```json
    {
      "messages": [
        {"role": "system", "content": "Optional system prompt"},
        {"role": "user", "content": "Your question here"}
      ],
      "stream": true/false,
      "maxTokens": 1000
    }
    ```

- **GET /BEDROCK/:payment_hash/get_result**: Retrieve the result of a Bedrock request

## Streaming vs Non-Streaming

The implementation supports both streaming and non-streaming responses:

- Set `stream: true` in your request body to get a streaming response using Server-Sent Events (SSE)
- Set `stream: false` or omit the field to get a standard JSON response

Streaming is particularly useful for long responses to provide a better user experience. 