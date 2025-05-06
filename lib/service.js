const { usd_to_millisats } = require("./common");
const { getBitcoinPrice } = require("./bitcoinPrice");
const axios  = require('axios');
const {
  GPT_SCHEMA,
  BEDROCK_SCHEMA
} = require('../const/serviceSchema');
const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require("@aws-sdk/client-bedrock-runtime");

function sanitizeData(data, schema) { //@Luke
  if (schema.type === "object" && schema.properties) {
      const newObj = {};
      for (const key in schema.properties) {
          if (data.hasOwnProperty(key)) {
              newObj[key] = sanitizeData(data[key], schema.properties[key]);
          }
      }
      return newObj;
  } else if (schema.type === "array" && schema.items) {
      if (Array.isArray(data)) {
          return data.map(item => sanitizeData(item, schema.items));
      }
      return [];
  } else {
      return data;
  }
}

async function getServicePrice(service) {
  const bitcoinPrice = await getBitcoinPrice(); 
  
  switch (service) {
    case "GPT":
      return usd_to_millisats(process.env.GPT_USD,bitcoinPrice);
    case "BEDROCK":
      return usd_to_millisats(process.env.BEDROCK_USD,bitcoinPrice);
    default:
      return process.env.GPT_MSATS;
  }
}

function submitService(service, data) {
  switch (service) {
    case "GPT":
      return callChatGPT(data);
    case "BEDROCK":
      return callBedrock(data);
    default:
      return callChatGPT(data);
  }
}

async function callChatGPT(data) {
  console.log("trying to sanitize data:", data)
  const sanitizedData = sanitizeData(data,GPT_SCHEMA);
  var config = {
    method: "post",
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CHAT_GPT_API_KEY}`,
    },
    data: sanitizedData,
  };

  try {
    console.log("Sending request with config:", JSON.stringify(config, null, 2));
    const response = await axios(config);
    return response.data;
  } catch (e) {
    console.log(`ERROR: ${e.toString().substring(0, 50)}`);
    return e;
  }
}

async function callBedrock(data) {
  console.log("trying to sanitize bedrock data:", data);
  const sanitizedData = sanitizeData(data, BEDROCK_SCHEMA);
  
  // Initialize Bedrock client
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  // Prepare messages array for the model
  let messageArray = [];
  
  // Add system prompt if provided
  if (sanitizedData.systemPrompt) {
    messageArray.push({ role: "system", content: sanitizedData.systemPrompt });
  }
  
  // Add all messages
  if (sanitizedData.messages && sanitizedData.messages.length > 0) {
    messageArray = [...messageArray, ...sanitizedData.messages];
  }

  // Check if streaming is requested
  if (sanitizedData.stream === true) {
    try {
      // For DeepSeek models, the streaming payload requires the stream flag
      const streamingPayload = {
        messages: messageArray,
        max_tokens: sanitizedData.maxTokens || 1000,
        stream: true  // Required for streaming with DeepSeek
      };

      const command = new InvokeModelWithResponseStreamCommand({
        modelId: process.env.BEDROCK_MODEL_ID || "us.deepseek.r1-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(streamingPayload),
      });

      console.log("Sending Bedrock streaming request with payload:", JSON.stringify(streamingPayload, null, 2));
      
      // The controller will handle the streaming response, so we just return the command and client
      // This allows the controller to stream the response directly to the client
      return {
        type: "stream",
        command: command,
        client: client
      };
    } catch (e) {
      console.log(`BEDROCK STREAMING ERROR: ${e.toString().substring(0, 100)}`);
      return e;
    }
  } else {
    // Non-streaming request (regular implementation)
    const payload = {
      messages: messageArray,
      max_tokens: sanitizedData.maxTokens || 1000,
    };

    try {
      const command = new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID || "us.deepseek.r1-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      });

      console.log("Sending Bedrock request with payload:", JSON.stringify(payload, null, 2));
      const response = await client.send(command);
      const data = JSON.parse(new TextDecoder().decode(response.body));
      
      // Add token usage information if available
      let usage = {};
      if (data.amazon?.bedrock?.invocationMetrics) {
        const metrics = data.amazon.bedrock.invocationMetrics;
        usage = {
          input_tokens: metrics.inputTokenCount || 0,
          output_tokens: metrics.outputTokenCount || 0,
          total_tokens: (metrics.inputTokenCount || 0) + (metrics.outputTokenCount || 0)
        };
      }
      
      // Format the response to be more similar to the ChatGPT response
      // This helps with consistency in the controller
      const formattedResponse = {
        choices: [
          {
            message: {
              role: "assistant",
              content: data.content || data.generation || ""
            }
          }
        ],
        usage: usage,
        model: process.env.BEDROCK_MODEL_ID || "us.deepseek.r1-v1:0",
        raw_response: data // Keep the original data for reference
      };

      console.log("formattedResponse:", JSON.stringify(formattedResponse, null, 2));
      
      return formattedResponse;
    } catch (e) {
      console.log(`BEDROCK ERROR: ${e.toString().substring(0, 100)}`);
      return e;
    }
  }
}

module.exports = { submitService, getServicePrice };