const api = require("./sfRestApi");

async function test() {
  try {
    console.log(await api.createRecord("Account", { Name: "Test Account 1" }));
  } catch (e) {
    console.log("An error occurred!", e);
  }
}
test();
