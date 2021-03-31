const aws = require('aws-sdk');

const handler = (event, ctx) =>
  Promise.resolve({
    event,
    ctx,
    node_version: process.version,
    remaining_time: ctx.getRemainingTimeInMillis(),
  })

module.exports = { handler };
