const aws = require('aws-sdk');

const handler = (event, ctx) =>
  Promise.resolve({
    event,
    ctx,
    node_version: process.version,
    remaining_time: ctx.getRemainingTimeInMillis(),
    aws: JSON.stringify(aws),
  })

module.exports = { handler };

