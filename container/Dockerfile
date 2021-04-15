
ARG NODE_VERSION=15.14.0
ARG AWS_SDK_VERSION=2.887.0
ARG AWS_LAMBDA_NODE_RUNTIME_VERSION=0.1.0

FROM node:${NODE_VERSION}-buster-slim

ARG BOOTSTRAP_DIR=/opt/bootstrap

ENV NODE_PATH=${BOOTSTRAP_DIR}/node_modules
ENV LAMBDA_TASK_ROOT=/var/task

RUN mkdir ${BOOTSTRAP_DIR} && \
  mkdir ${LAMBDA_TASK_ROOT} && \
  cd ${BOOTSTRAP_DIR} && \
  npm install --no-save aws-sdk@${AWS_SDK_VERSION} && \
  npm install --no-save -g aws-lambda-node-runtime@${AWS_LAMBDA_NODE_RUNTIME_VERSION}

WORKDIR ${LAMBDA_TASK_ROOT}
# COPY hello.js ${LAMBDA_TASK_ROOT}/

ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-node-runtime"]
# CMD ["hello.handler"]
