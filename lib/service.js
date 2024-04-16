const { usd_to_millisats } = require("./common");
const { getBitcoinPrice } = require("./bitcoinPrice");
const axios  = require('axios');
const {
  GPT_SCHEMA
} = require('../const/serviceSchema');

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
    default:
      return process.env.GPT_MSATS;
  }
}

function submitService(service, data) {
  switch (service) {
    case "GPT":
      return callChatGPT(data);
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

module.exports = { submitService, getServicePrice };