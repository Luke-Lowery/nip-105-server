const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const baseUrl = `http://localhost:${process.env.BEDROCK_PORT || 3001}`;

// Test the Bedrock query endpoint
async function testBedrockQuery() {
  try {
    console.log('Testing Bedrock Query endpoint (non-streaming)...');
    
    const response = await axios.post(`${baseUrl}/bedrock/query`, {
      messages: [
        { role: 'user', content: 'What is Amazon Bedrock?' }
      ],
      stream: false
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Check if we got proper response
    if (response.data.response && response.data.usage) {
      console.log('✅ Test passed: Received proper response from Bedrock');
      console.log(`Input tokens: ${response.data.usage.input_tokens}`);
      console.log(`Output tokens: ${response.data.usage.output_tokens}`);
      console.log(`Total tokens: ${response.data.usage.total_tokens}`);
    } else {
      console.log('❌ Test failed: Did not receive proper response format');
    }
  } catch (error) {
    console.error('Error testing Bedrock Query endpoint:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Test the Bedrock query endpoint with streaming
async function testBedrockStreamingQuery() {
  try {
    console.log('\nTesting Bedrock Query endpoint (streaming)...');
    
    // Using axios for SSE is not ideal, this is just for demonstration
    // In a real application, you'd use a proper SSE client
    const response = await axios({
      method: 'post',
      url: `${baseUrl}/bedrock/query`,
      data: {
        messages: [
          { role: 'user', content: 'Write a short poem about AI' }
        ],
        stream: true
      },
      responseType: 'stream'
    });
    
    console.log('Streaming response:');
    
    response.data.on('data', (chunk) => {
      const data = chunk.toString();
      // SSE data comes in the format "data: {...}\n\n"
      if (data.startsWith('data: ')) {
        const jsonStr = data.slice(6); // Remove "data: " prefix
        try {
          const parsedData = JSON.parse(jsonStr);
          console.log('Received chunk:', parsedData);
        } catch (e) {
          console.log('Raw chunk:', data);
        }
      }
    });
    
    response.data.on('end', () => {
      console.log('✅ Streaming test completed');
    });
    
    response.data.on('error', (err) => {
      console.error('❌ Stream error:', err);
    });
  } catch (error) {
    console.error('Error testing Bedrock Streaming endpoint:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Test the cost estimation endpoint
async function testCostEstimation() {
  try {
    console.log('\nTesting Cost Estimation endpoint...');
    
    const response = await axios.post(`${baseUrl}/bedrock/estimate-cost`, {
      inputTokens: 500,
      outputTokens: 1000
    });
    
    console.log('Cost estimation:', response.data);
    
    if (response.data.estimated_cost && 
        response.data.estimated_cost.input_cost !== undefined && 
        response.data.estimated_cost.output_cost !== undefined) {
      console.log('✅ Test passed: Cost estimation endpoint returned proper data');
    } else {
      console.log('❌ Test failed: Cost estimation endpoint did not return proper data');
    }
  } catch (error) {
    console.error('Error testing Cost Estimation endpoint:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
async function runTests() {
  try {
    // Test the health endpoint first to make sure server is running
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('Health check:', healthResponse.data);
    
    if (healthResponse.data.status === 'healthy') {
      console.log('✅ Server is healthy');
      
      // Run the actual tests
      await testBedrockQuery();
      await testCostEstimation();
      await testBedrockStreamingQuery();
    } else {
      console.log('❌ Server is not healthy');
    }
  } catch (error) {
    console.error('Error connecting to server:', error.message);
    console.log('Make sure your Bedrock server is running on port', process.env.BEDROCK_PORT || 3001);
  }
}

// Run all tests
runTests(); 