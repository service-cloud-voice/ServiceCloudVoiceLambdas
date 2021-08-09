const api = require("./telephonyIntegrationApi");

async function test() {
  try {
    console.log(await api.createVoiceCall());
  } catch (e) {
    console.log("An error occurred!", e);
  }
}

test();
