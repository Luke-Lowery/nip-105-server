const asyncHandler = require('../middleware/async');
const crypto = require('crypto');
const { getServicePrice, submitService } = require('../lib/service');
const { createNewJobDocument, findJobRequestByPaymentHash, getIsInvoicePaid, generateInvoice } = require('../lib/nip105');
const { logState } = require('../lib/common');

exports.postService = asyncHandler(async (req,res,next) =>{
    const authAllowed = req.body?.authAllowed;
    const service = req.params.service;
    if (authAllowed) {
      // Simulate successful payment and service execution
      try {
          // Create a fake payment hash
          const fakePaymentHash = crypto.randomBytes(20).toString('hex');
          const price = await getServicePrice(service); // Assuming price determination logic is in place
          const fakeInvoice = { verify: "fakeURL", pr: "fakePaymentRequest", paymentHash: fakePaymentHash };

          // Directly simulate creating a new job document as if it was paid
          await createNewJobDocument(service, fakeInvoice, fakePaymentHash, price);

          // Simulate executing the service directly and preparing the result
          const doc = await findJobRequestByPaymentHash(fakePaymentHash);
          doc.status = "PAID";
          doc.state = "NOT_PAID";//set invoice to paid but work status as NOT_PAID to force run
          doc.requestData = req.body;
          await doc.save();

          const successAction =  {
            tag: "url",
            url: `${process.env.ENDPOINT}/${service}/${fakePaymentHash}/get_result`,
            description: "Open to get the confirmation code for your purchase."
          };

          // Return the simulated result
          res.status(200).send({paymentHash: fakePaymentHash, authCategory: req.body.authCategory, successAction});
      } catch (e) {
          console.log(e.toString().substring(0, 150));
          res.status(500).send(e);
      }
      return;
    }
    try {
      const service = req.params.service;
      const invoice = await generateInvoice(service);
      const doc = await findJobRequestByPaymentHash(invoice.paymentHash);
      const successAction =  {
        tag: "url",
        url: `${process.env.ENDPOINT}/${service}/${invoice.paymentHash}/get_result`,
        description: "Open to get the confirmation code for your purchase."
    };
  
      doc.requestData = req.body;
      doc.state = "NOT_PAID";
      await doc.save();
  
      logState(service, invoice.paymentHash, "REQUESTED");
  
      res.status(402).send({...invoice, authCategory: req.body.authCategory, successAction});
    } catch (e) {
      console.log(e.toString().substring(0, 150));
      res.status(500).send(e);
    }
});

exports.checkPayment = asyncHandler(async (req,res,next) =>{
    try {
        const paymentHash = req.params.payment_hash;
        const { isPaid, invoice } = await getIsInvoicePaid(paymentHash);

        res.status(200).json({ invoice, isPaid });
    } catch (e) {
        console.log(e.toString().substring(0, 50));
        res.status(500).send(e);
    }
});

exports.getResult = asyncHandler(async (req,res,next) =>{
    try {
        const service = req.params.service;
        const paymentHash = req.params.payment_hash;
        const authAllowed = req.body.authAllowed;
        const authCategory = req.body.authCategory;
        const shouldSkipPaidVerify = authCategory === 1
        const { invoice, isPaid } = await getIsInvoicePaid(paymentHash,shouldSkipPaidVerify);
        const successAction =  {
            tag: "url",
            url: `${process.env.ENDPOINT}/${service}/${paymentHash}/get_result`,
            description: "Open to get the confirmation code for your purchase."
        };

        logState(service, paymentHash, "POLL");
        if (!authAllowed && !isPaid) {
            res.status(402).send({ ...invoice, isPaid, authCategory, successAction});
        } 
        else {
            const doc = await findJobRequestByPaymentHash(paymentHash);

            switch (doc.state) {
            case "WORKING":
                logState(service, paymentHash, "WORKING");
                res.status(202).send({state: doc.state, authCategory, paymentHash, successAction});
                break;
            case "ERROR":
            case "DONE":
                logState(service, paymentHash, doc.state);
                res.status(200).send({...doc.requestResponse, authCategory, paymentHash, successAction});
                break;
            default:
                logState(service, paymentHash, "PAID");
                const data = doc.requestData;

                // Use async/await to ensure sequential execution
                try {
                    const response = await submitService(service, data);
                    console.log(`requestResponse:`, response);

                    // Handle Bedrock streaming response specifically
                    if (service === "BEDROCK" && response.type === "stream") {
                        // Mark that we're handling this as a streaming response
                        doc.state = "STREAMING";
                        await doc.save();

                        // Set up SSE headers
                        res.setHeader('Content-Type', 'text/event-stream');
                        res.setHeader('Cache-Control', 'no-cache');
                        res.setHeader('Connection', 'keep-alive');
                        
                        // Send initial connection message
                        res.write(`data: ${JSON.stringify({ type: "connection_established" })}\n\n`);
                        
                        try {
                            const streamResponse = await response.client.send(response.command);
                            
                            // Track token usage
                            let inputTokens = 0;
                            let outputTokens = 0;
                            let responseData = [];
                            
                            for await (const chunk of streamResponse.body) {
                                if (chunk.chunk && chunk.chunk.bytes) {
                                    const chunkData = new TextDecoder().decode(chunk.chunk.bytes);
                                    try {
                                        const parsedData = JSON.parse(chunkData);
                                        
                                        // Store the response data to save in the document
                                        responseData.push(parsedData);
                                        
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
                            
                            // Save the complete response data to the document
                            doc.requestResponse = {
                                response: responseData,
                                usage: {
                                    input_tokens: inputTokens,
                                    output_tokens: outputTokens,
                                    total_tokens: inputTokens + outputTokens
                                }
                            };
                            doc.state = "DONE";
                            await doc.save();
                            
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
                            return;
                        } catch (error) {
                            console.error("Streaming error:", error);
                            res.write(`data: ${JSON.stringify({ error: error.message || "Unknown streaming error" })}\n\n`);
                            res.end();
                            
                            // Update the document with the error
                            doc.requestResponse = { error: error.message || "Unknown streaming error" };
                            doc.state = "ERROR";
                            await doc.save();
                            return;
                        }
                    } else {
                        // Normal non-streaming response
                        doc.requestResponse = response;
                        doc.state = "DONE";
                    }
                } catch (e) {
                    doc.requestResponse = e;
                    doc.state = "ERROR";
                    console.log("submitService error:", e)
                }

                // Save the document after setting the state
                await doc.save();

                doc.state = "WORKING";
                res.status(202).send({state: doc.state, authCategory, paymentHash, successAction});
            }
        }
    } catch (e) {
    console.log(e.toString().substring(0, 300));
    res.status(500).send(e);
    }
});