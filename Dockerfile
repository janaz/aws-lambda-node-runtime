FROM node:14.8.0-buster-slim@sha256:c253a1a9569e95414f30c6094bdb7f7561c17ad93447d2747405e367066a841a

RUN apt-get update && apt-get install -y p7zip-full curl xz-utils && apt-get clean all
