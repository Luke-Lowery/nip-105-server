const { getPublicKey, getServicePrice, relayInit } = require("nostr-tools");
const { createOfferingNote } = require("./nostr");
const {
  GPT_RESULT_SCHEMA,
  GPT_SCHEMA
} = require('../const/serviceSchema');

async function postOfferings() {
  const sk = process.env.NOSTR_SK;
  const pk = getPublicKey(sk);

  const relay = relayInit(process.env.NOSTR_RELAY);
  relay.on("connect", () => {
    console.log(`connected to ${relay.url}`);
  });
  relay.on("error", (e) => {
    console.log(`failed to connect to ${relay.url}: ${e}`);
  });
  await relay.connect();

  const gptPrice = await getServicePrice("GPT")

  const gptOffering = createOfferingNote(
    pk,
    sk,
    "https://api.openai.com/v1/chat/completions",
    Number(gptPrice),
    process.env.ENDPOINT + "/" + "GPT",
    "UP",
    GPT_SCHEMA,
    GPT_RESULT_SCHEMA,
    "Get your GPT needs here!"
  );

  await relay.publish(gptOffering);
  console.log(`Published GPT Offering: ${gptOffering.id}`);
  relay.close();
}

module.exports = { postOfferings };