const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require("@aws-sdk/client-bedrock-runtime");

// Create a function that configures the routes
function setupBedrockRoutes(app, config) {
  const client = new BedrockRuntimeClient({
    region: config.region || process.env.AWS_REGION,
    credentials: {
      accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  // Query endpoint
  app.post("/bedrock/query", async (req, res) => {
    const { prompt, stream = false, messages = [], systemPrompt = "" } = req.body;

    if (!prompt && messages.length === 0) {
      return res.status(400).json({ error: "Prompt or messages are required" });
    }

    // Prepare messages array for the model
    let messageArray = [];
    
    // Add system prompt if provided
    if (systemPrompt) {
      messageArray.push({ role: "system", content: systemPrompt });
    }
    
    // Add previous messages if provided
    if (messages.length > 0) {
      messageArray = [...messageArray, ...messages];
    }
    
    // Add the current prompt if provided
    if (prompt) {
      messageArray.push({ role: "user", content: prompt });
    }

    if (stream) {
      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // For DeepSeek models, the streaming payload is different
      const streamingPayload = {
        messages: messageArray,
        max_tokens: config.maxTokens || 1000,
        stream: true  // This is required for streaming with DeepSeek
      };

      const command = new InvokeModelWithResponseStreamCommand({
        modelId: config.modelId || "us.deepseek.r1-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(streamingPayload),
      });

      try {
        const streamResponse = await client.send(command);
        
        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: "connection_established" })}\n\n`);
        
        // Track token usage
        let inputTokens = 0;
        let outputTokens = 0;
        
        for await (const chunk of streamResponse.body) {
          if (chunk.chunk && chunk.chunk.bytes) {
            const chunkData = new TextDecoder().decode(chunk.chunk.bytes);
            try {
              const parsedData = JSON.parse(chunkData);
              
              // Track token usage if available in the response
              if (parsedData.amazon?.bedrock?.invocationMetrics) {
                inputTokens = parsedData.amazon.bedrock.invocationMetrics.inputTokenCount || 0;
                outputTokens = parsedData.amazon.bedrock.invocationMetrics.outputTokenCount || 0;
              }
              
              res.write(`data: ${JSON.stringify(parsedData)}\n\n`);
            } catch (e) {
              console.error("Error parsing chunk:", e);
              res.write(`data: ${JSON.stringify({ error: "Error parsing chunk" })}\n\n`);
            }
          }
        }
        
        // Send completion message with token usage
        res.write(`data: ${JSON.stringify({ 
          type: "done", 
          usage: { 
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens
          }
        })}\n\n`);
        res.end();
      } catch (error) {
        console.error("Streaming error:", error);
        res.write(`data: ${JSON.stringify({ error: error.message || "Unknown streaming error" })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming request
      const payload = {
        messages: messageArray,
        max_tokens: config.maxTokens || 1000,
      };

      const command = new InvokeModelCommand({
        modelId: config.modelId || "us.deepseek.r1-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      });

      try {
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
        
        res.json({ 
          response: data,
          usage: usage
        });
      } catch (error) {
        console.error("Error querying DeepSeek:", error);
        res.status(500).json({ error: "Error querying DeepSeek" });
      }
    }
  });
  
  // Add a cost estimation endpoint
  app.post("/bedrock/estimate-cost", (req, res) => {
    const { inputTokens = 0, outputTokens = 0 } = req.body;
    
    // DeepSeek pricing (adjust as needed)
    const inputCostPer1K = 0.0005;  // $0.0005 per 1K input tokens
    const outputCostPer1K = 0.0015; // $0.0015 per 1K output tokens
    
    const inputCost = (inputTokens / 1000) * inputCostPer1K;
    const outputCost = (outputTokens / 1000) * outputCostPer1K;
    const totalCost = inputCost + outputCost;
    
    res.json({
      estimated_cost: {
        input_cost: inputCost,
        output_cost: outputCost,
        total_cost: totalCost
      }
    });
  });
}

module.exports = setupBedrockRoutes; 