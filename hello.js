const aws = require('aws-sdk');

const handler = (event, ctx) =>
  Promise.resolve({
    event,
    ctx,
    node_version: process.version,
    remaining_time: ctx.getRemainingTimeInMillis(),
    aws_sdk_version: aws.version,
  })

module.exports = { handler };

