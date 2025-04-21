# NIP-105 AI Services API Server

This repository implements a server following the [NIP-105 specification](./105.md) for API Service Marketplace. It provides access to multiple AI language models (including OpenAI GPT and AWS Bedrock DeepSeek), secured through various authentication methods and Lightning Network payments.

## Features

- **Multiple LLM Endpoints**: Access to GPT-3.5-turbo and DeepSeek R1 models
- **Authentication Options**:
  - Lightning Network payments
  - HMAC authentication
  - Preimage verification
  - User eligibility verification
- **Streaming Responses**: Support for Server-Sent Events (SSE) streaming with compatible models
- **NIP-105 Compliance**: Implements the NIP-105 specification for API services

## Getting Started

### Installation

1. Clone the repository
2. Copy the environment file and configure your settings:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

Configure the following environment variables:

#### Server Configuration
- `PORT`: Server port (default: 3132)
- `MONGO_URI`: MongoDB connection string
- `ENDPOINT`: Public endpoint URL
- `SHARED_HMAC_SECRET`: Secret for HMAC authentication

#### Model API Keys
- `CHAT_GPT_API_KEY`: OpenAI API key for GPT models
- `AWS_ACCESS_KEY_ID`: AWS access key for Bedrock
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for Bedrock
- `AWS_REGION`: AWS region for Bedrock (e.g., us-east-2)
- `BEDROCK_MODEL_ID`: Bedrock model ID (default: us.deepseek.r1-v1:0)

#### Payment Configuration
- `LN_ADDRESS`: Lightning address for receiving payments
- `GPT_USD`: Price in USD for GPT requests
- `BEDROCK_USD`: Price in USD for Bedrock requests

### Running the Server

```bash
node server.js
```

## API Endpoints

### Authentication Methods

The server supports three authentication methods:

1. **HMAC Authentication**:
   ```
   X-Timestamp: <current unix timestamp>
   X-Hmac-Signature: <HMAC-SHA256 of timestamp using SHARED_HMAC_SECRET>
   ```

2. **Bearer Token Authentication**:
   ```
   Authorization: Bearer <token>
   ```

3. **Lightning Network Payment**:
   - Pay the returned invoice to access the API

### Available API Endpoints

#### GPT-3.5 Turbo (OpenAI)

**Request:**
```http
POST /GPT
Content-Type: application/json

{
  "model": "gpt-3.5-turbo",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Your question here."}
  ]
}
```

**Response:**
- If authenticated: Direct response with completion
- If not authenticated: Payment invoice

#### DeepSeek R1 (AWS Bedrock)

**Request:**
```http
POST /BEDROCK
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "Your question here."}
  ],
  "stream": false,
  "maxTokens": 1000,
  "systemPrompt": "Optional system prompt."
}
```

**Response:**
- If authenticated: Direct response with completion
- If not authenticated: Payment invoice

#### Retrieving Results

After payment or with valid authentication:

```http
GET /{SERVICE}/{payment_hash}/get_result
```

Where:
- `{SERVICE}` is either `GPT` or `BEDROCK`
- `{payment_hash}` is the hash returned in the initial request

## Code Examples

### CURL Examples

#### GPT Request with HMAC Authentication

```bash
SHARED_SECRET="YOUR_HMAC_SECRET"
TIMESTAMP=$(date +%s)
HMAC_SIGNATURE=$(echo -n "$TIMESTAMP" | openssl dgst -sha256 -hmac "$SHARED_SECRET" | cut -d " " -f 2)

curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Hmac-Signature: $HMAC_SIGNATURE" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Tell me a joke about programming."}
    ]
  }' \
  https://your-server-url/GPT
```

#### Bedrock Request with HMAC Authentication

```bash
SHARED_SECRET="YOUR_HMAC_SECRET"
TIMESTAMP=$(date +%s)
HMAC_SIGNATURE=$(echo -n "$TIMESTAMP" | openssl dgst -sha256 -hmac "$SHARED_SECRET" | cut -d " " -f 2)

curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Hmac-Signature: $HMAC_SIGNATURE" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is AWS Bedrock?"}
    ],
    "stream": false
  }' \
  https://your-server-url/BEDROCK
```

### Payment Flow

1. Send request to `/GPT` or `/BEDROCK`
2. Receive payment invoice in response
3. Pay the invoice
4. Use the payment hash to fetch the result from `/{SERVICE}/{payment_hash}/get_result`

## Testing

### Test HMAC Authentication

Use the included script:

```bash
./test-hmac-auth.sh [SERVER_URL] [HMAC_SECRET]
```

### Test All Services

```bash
./test-all-services.sh [PORT]
```

## Technical Details

### Service Flow

1. Request is received and passes through authentication middleware
2. If authenticated, the service is executed directly
3. If not authenticated, a Lightning invoice is generated
4. Once paid, the result is processed and stored
5. Client can fetch the result using the payment hash

### Supported Request Parameters

#### GPT Model
- `model`: The model to use (currently only "gpt-3.5-turbo")
- `messages`: Array of message objects with role and content

#### Bedrock Model
- `messages`: Array of message objects with role and content
- `stream`: Boolean to enable streaming responses
- `maxTokens`: Maximum tokens to generate
- `systemPrompt`: System prompt to prepend

## License

See LICENSE file for details.



