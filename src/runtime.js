const http = require('http');

let _lambdaHandler;
const getLambdaHandler = () => {
  return new Promise((resolve, reject) => {
    if (typeof _lambdaHandler === 'undefined') {
      const [modName, handlerName] = process.env['_HANDLER'].split('.');
      _lambdaHandler = require(`${process.env.LAMBDA_TASK_ROOT}/${modName}`)[handlerName];
    }
    if (typeof _lambdaHandler === 'function') {
      resolve(_lambdaHandler);
    } else {
      reject(new Error("Can't find the handler"));
    }
  });
};

const request = (method, path, body) => {
  return new Promise((resolve, reject) => {
    const [host, port] = process.env.AWS_LAMBDA_RUNTIME_API.split(':')
    const headers = {
      'Accept': 'application/json',
    }
    if (typeof body !== 'undefined') {
      headers['Content-Type'] = 'application/json',
      headers['Content-Length'] = Buffer.byteLength(body)
    }
    const options = {
      hostname: host,
      port: port || 80,
      path,
      method,
      headers
    };
    console.log(method, host, port, path);
    const req = http.request(options, (resp) => {
      const data = [];

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data.push(chunk);
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        if (resp.complete) {
          resolve({
            status: resp.statusCode,
            headers: resp.headers,
            body: Buffer.concat(data)
          });
        } else {
          reject(new Error("The connection was terminated while the message was still being sent"))
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.abort();
      //this will call the `error` callback
    });
    if (typeof body !== 'undefined') {
      req.write(body);
    }
    req.end();
  });
}

const errObj = (err) =>({
  errorMessage: err.message,
  errorType: err.toString()
});

const fetchNext = () => request('GET', '/2018-06-01/runtime/invocation/next');

const sendSuccessResponse = (id, obj) =>
  request('POST', `/2018-06-01/runtime/invocation/${id}/response`, obj);

const sendErrorResponse = (id, err) =>
  request('POST', `/2018-06-01/runtime/invocation/${id}/error`, errObj(err));

const sendErrorInit = (err) =>
  request('POST', `/2018-06-01/runtime/init/error`,  errObj(err));

const callHandler = (obj, ctx) => {
  return new Promise((resolve, reject) => {
    let resolveCalled = false;
    let rejectCalled = false;
    const wrappedResolve = (val) => {
      if (resolveCalled) {
        console.log("resolve has been already called")
        return
      }
      if (rejectCalled) {
        console.log("calling resolve, but reject has been already called")
        return
      }
      resolveCalled = true;
      resolve(val);
    }
    const wrappedReject = (err) => {
      if (rejectCalled) {
        console.log("reject has been already called")
        return
      }
      if (resolveCalled) {
        console.log("calling reject, but resolve has been already called")
        return
      }
      rejectCalled = true;
      reject(err);
    }
    const cb = (err, val) => {
      if (err) {
        if (!ctx.callbackWaitsForEmptyEventLoop) {
          wrappedReject(err);
        } else {
          setTimeout(() => wrappedReject(err), 0);
        }
      } else {
        if (!ctx.callbackWaitsForEmptyEventLoop) {
          wrappedResolve(val);
        } else {
          setTimeout(() => wrappedResolve(val), 0);
        }
      }
    };
    getLambdaHandler().then(f => {
      try {
        const retVal = f.call(null, obj, ctx, cb);
        if (typeof retVal === 'object' && typeof retVal.then === 'function') {
          retVal.then(wrappedResolve, wrappedReject);
        }
      } catch (e) {
        wrappedReject(e);
      }
    });
  });
}

const processNextRequest = () => {
  return fetchNext()
    .then(({status, headers, body}) => {
      const json = JSON.parse(body.toString());
      if (status !== 200) {
        console.log(`Expected response with status 200, but received ${status}`);
        console.log('Retrying...');
        return;
      }
      const requestId = headers['lambda-runtime-aws-request-id'];
      const deadlineMs = parseInt(headers['lambda-runtime-deadline-ms']);
      process.env['_X_AMZN_TRACE_ID'] = headers['lambda-runtime-trace-id'];
      const ctx = {
        getRemainingTimeInMillis: () => {
          return deadlineMs - (new Date()).getTime();
        },
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
        invokedFunctionArn: headers['lambda-runtime-invoked-function-arn'],
        memoryLimitInMB: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
        awsRequestId: requestId,
        logGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
        logStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
        callbackWaitsForEmptyEventLoop: true,
        identity: headers['lambda-runtime-cognito-identity'],
        clientContext: headers['lambda-runtime-client-context'],
      }
      return callHandler(json, ctx).then(
        (response) => {
          return sendSuccessResponse(requestId, response);
        },
        (err) => {
          return sendErrorResponse(requestId, err);
        }
      )
      .catch((err) => {
        console.error("Failed to send the response", err);
      });
    })
    .then(processNextRequest);
};

//----- start here

console.log("Runtime starting");

getLambdaHandler()
  .then(
    processNextRequest,
    (err) => {
      console.error("Init error", err);
      return sendErrorInit(err);
    }
  )
  .catch((err) => {
    console.log("Runtime exiting", err);
  });
