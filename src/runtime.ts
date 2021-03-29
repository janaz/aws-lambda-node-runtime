import http from 'http';

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 1,
});

type Callback = (err: null | Error, value: object) => void;

interface Context {
  callbackWaitsForEmptyEventLoop: boolean
  getRemainingTimeInMillis: () => number
  functionName: string
  functionVersion: string
  invokedFunctionArn: string
  memoryLimitInMB: number
  awsRequestId: string
  logGroupName: string
  logStreamName: string
  identity: string
  clientContext: string
}

interface Response {
  status: number
  headers: http.IncomingHttpHeaders
  body: Buffer
}

interface Config {
  _HANDLER: string
  LAMBDA_TASK_ROOT: string
  AWS_LAMBDA_RUNTIME_API: string
  AWS_LAMBDA_FUNCTION_NAME: string
  AWS_LAMBDA_FUNCTION_VERSION: string
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE: number
  AWS_LAMBDA_LOG_GROUP_NAME: string
  AWS_LAMBDA_LOG_STREAM_NAME: string
}
interface LambdaHeaders {
  'lambda-runtime-aws-request-id': string
  'lambda-runtime-deadline-ms': string
  'lambda-runtime-trace-id': string
  'lambda-runtime-invoked-function-arn': string
  'lambda-runtime-cognito-identity': string
  'lambda-runtime-client-context': string
}

const getEnv = (item: keyof Config): string => {
  if (typeof process.env[item] === 'undefined') {
    throw new Error(`Environment variable ${item} not set`)
  } else {
    return process.env[item] as string;
  }
}

const CONFIG: Promise<Config> = new Promise(r => {
  r({
    _HANDLER: getEnv('_HANDLER'),
    LAMBDA_TASK_ROOT: getEnv('LAMBDA_TASK_ROOT'),
    AWS_LAMBDA_RUNTIME_API: getEnv('AWS_LAMBDA_RUNTIME_API'),
    AWS_LAMBDA_FUNCTION_NAME: getEnv('AWS_LAMBDA_FUNCTION_NAME'),
    AWS_LAMBDA_FUNCTION_VERSION: getEnv('AWS_LAMBDA_FUNCTION_VERSION'),
    AWS_LAMBDA_FUNCTION_MEMORY_SIZE: Number.parseInt(getEnv('AWS_LAMBDA_FUNCTION_MEMORY_SIZE'), 10),
    AWS_LAMBDA_LOG_GROUP_NAME: getEnv('AWS_LAMBDA_LOG_GROUP_NAME'),
    AWS_LAMBDA_LOG_STREAM_NAME: getEnv('AWS_LAMBDA_LOG_STREAM_NAME'),
  });
});

type LambdaHandler = (event: object, context: Context, callback: Callback) => Promise<object> | void;

let _lambdaHandler: LambdaHandler | undefined = undefined;

const getLambdaHandler = async (cfg: Config): Promise<LambdaHandler> => {
  if (typeof _lambdaHandler === 'undefined') {
    const [modName, handlerName] = cfg._HANDLER.split('.');
    _lambdaHandler = require(`${cfg.LAMBDA_TASK_ROOT}/${modName}`)[handlerName];
  }
  if (typeof _lambdaHandler === 'function') {
    return _lambdaHandler;
  } else {
    throw new Error("Can't find the handler");
  }
};

const request = (cfg: Config) => (method: string, path: string, body?: object): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const [host, port] = cfg.AWS_LAMBDA_RUNTIME_API.split(':')
    const headers: http.OutgoingHttpHeaders = {
      Accept: 'application/json',
    }
    let payload: Buffer | undefined;
    if (typeof body !== 'undefined') {
      payload = Buffer.from(JSON.stringify(body));
      headers['Content-Type'] = 'application/json',
      headers['Content-Length'] = String(Buffer.byteLength(payload))
    }
    const options: http.RequestOptions = {
      hostname: host,
      port: port || 80,
      agent,
      path,
      method,
      headers
    };
    const req = http.request(options, (response) => {
      const data: Buffer[] = [];

      // A chunk of data has been recieved.
      response.on('data', (chunk) => {
        data.push(chunk);
      });

      // The whole response has been received. Print out the result.
      response.on('end', () => {
        if (response.complete) {
          resolve({
            status: response.statusCode as number,
            headers: response.headers,
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
    if (typeof payload !== 'undefined') {
      req.write(payload);
    }
    req.end();
  });
}

const errObj = (err: Error) =>({
  errorMessage: err.message,
  errorType: err.toString()
});

const fetchNext = (cfg: Config) => request(cfg)('GET', '/2018-06-01/runtime/invocation/next');

const sendSuccessResponse = (cfg: Config, id: string, obj: object) =>
  request(cfg)('POST', `/2018-06-01/runtime/invocation/${id}/response`, obj);

const sendErrorResponse = (cfg: Config, id: string, err: Error) =>
  request(cfg)('POST', `/2018-06-01/runtime/invocation/${id}/error`, errObj(err));

const sendErrorInit = (cfg: Config, err: Error) =>
  request(cfg)('POST', `/2018-06-01/runtime/init/error`, errObj(err));

const callHandler = (handler: LambdaHandler, obj: object, ctx: Context): Promise<object> => {
  return new Promise((resolve, reject) => {
    let resolveCalled = false;
    let rejectCalled = false;
    const wrappedResolve = (val: object) => {
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
    const wrappedReject = (err: Error) => {
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
    const cb = (err: Error | null, val: object) => {
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
    try {
      const retVal = handler.call(null, obj, ctx, cb);
      if (typeof retVal === 'object' && typeof retVal.then === 'function') {
        retVal.then(wrappedResolve, wrappedReject);
      }
    } catch (e) {
      wrappedReject(e);
    }
  });
}

const processNextRequest = async (handler: LambdaHandler, cfg: Config): Promise<Response | undefined> => {
  const {status, headers: _headers, body} = await fetchNext(cfg)
  const headers = (_headers as unknown ) as LambdaHeaders;
  const json = JSON.parse(body.toString());
  if (status !== 200) {
    console.warn(`Expected response with status 200, but received ${status}. Retrying...`);
    return processNextRequest(handler, cfg);
  }
  const requestId = headers['lambda-runtime-aws-request-id'];
  const deadlineMs = Number.parseInt(headers['lambda-runtime-deadline-ms'], 10);
  process.env._X_AMZN_TRACE_ID = headers['lambda-runtime-trace-id'];
  const ctx: Context = {
    getRemainingTimeInMillis: () => {
      return deadlineMs - (new Date()).getTime();
    },
    functionName: cfg.AWS_LAMBDA_FUNCTION_NAME,
    functionVersion: cfg.AWS_LAMBDA_FUNCTION_VERSION,
    invokedFunctionArn: headers['lambda-runtime-invoked-function-arn'],
    memoryLimitInMB: cfg.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
    awsRequestId: requestId,
    logGroupName: cfg.AWS_LAMBDA_LOG_GROUP_NAME,
    logStreamName: cfg.AWS_LAMBDA_LOG_STREAM_NAME,
    callbackWaitsForEmptyEventLoop: false,
    identity: headers['lambda-runtime-cognito-identity'],
    clientContext: headers['lambda-runtime-client-context'],
  }
  try {
    const response = await callHandler(handler, json, ctx)
    try {
      await sendSuccessResponse(cfg, requestId, response);
    } catch (e) {
      console.error("Failed to send the success response", e);
    }
  } catch (err) {
    try {
      await sendErrorResponse(cfg, requestId, err);
    } catch (e) {
      console.error("Failed to send the error response", e);
    }
  }
  return processNextRequest(handler, cfg)
};

//----- start here

const run = async () => {
  const cfg = await CONFIG;
  let handler: LambdaHandler | undefined
  try {
    handler = await getLambdaHandler(cfg);
  } catch (err) {
    sendErrorInit(cfg, err)
    throw err;
  }
  await processNextRequest(handler, cfg);
};

console.log("Runtime starting");
run()
  .then(() => console.log("Runtime exiting"))
  .catch((err: Error) => console.error("Runtime exiting", err))
