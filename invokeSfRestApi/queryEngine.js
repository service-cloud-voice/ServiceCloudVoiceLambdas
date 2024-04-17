const api = require("./sfRestApi");
const SCVLoggingUtil = require("./SCVLoggingUtil");

function formatQuery(args, queryStr) {
  let query;
  Object.keys(args).forEach((key) => {
    const replacement = `{${key}}`;
    query = queryStr.replace(replacement, args[key]);
  });
  return query;
}

// invokes the query from sf rest api
// can take the query as a formatted string of sorts,
// replacing {key} with its value in the js object
async function invokeQuery(query, args) {
  const formattedQuery = formatQuery(args, query);
  SCVLoggingUtil.debug({
    message: "invoke query from SfRestApi",
    context: { payload: formattedQuery },
  });
  return api.queryRecord(formattedQuery);
}

module.exports = {
  invokeQuery,
  formatQuery,
};
