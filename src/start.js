const runtime = require('aws-lambda-node-runtime');

const done = (err) => {
  if (err) {
    console.error('Runtime exiting due to an error', err);
  }
}

runtime(done);
