const express = require('express');

const api = express();

api.use(express.json());

api.get('/2018-06-01/runtime/invocation/next', (_, res) => {
  console.log("invocation next");
  setTimeout(() => {
    res.set({
      'lambda-runtime-aws-request-id': `aws-req-id-${Math.random()}`,
      'lambda-runtime-deadline-ms': (new Date()).getTime() + 100,
      'lambda-runtime-trace-id': `xray-trace-id-${Math.random()}`,
      'lambda-runtime-invoked-function-arn': 'test-function-arn',
      'lambda-runtime-client-context': JSON.stringify({
        client: {
          installation_id: 'installation_id',
          app_title: 'app_title',
          app_version_name: 'app_version_name',
          app_version_code: 'app_version_code',
          app_package_name: 'app_package_name',
        },
        env: {
          platform_version: 'platform_version',
          platform: 'platform',
          make: 'make',
          model: 'model',
          locale: 'locale',
        },
        custom: {
          key: 'value',
        },
      }),
      'lambda-runtime-cognito-identity': JSON.stringify({
        cognitoIdentityId: 'cognitoIdentityIdExample',
        cognitoIdentityPoolId: 'cognitoIdentityPoolIdExample'
      }),
    });
    res.json({x: 42, y: 24});
  }, 1000)
});

api.post('/2018-06-01/runtime/invocation/:id/error', (req, res) => {
  console.log("invocation error", JSON.stringify(req.body));
  res.json({});
});

api.post('/2018-06-01/runtime/invocation/:id/response', (req, res) => {
  console.log("invocation response", JSON.stringify(req.body));
  res.json({});
});

api.post('/2018-06-01/runtime/init/error', (req, res) => {
  console.log("init error", JSON.stringify(req.body));
  res.json({});
});

module.exports = api;
