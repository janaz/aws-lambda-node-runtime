FROM node:14.1.0-stretch-slim@sha256:b71737516643fa2c1df6d5a76ab5d4e7e959b3c40e494ff2b9587be2af9efd55

RUN apt-get update && apt-get install -y p7zip-full curl xz-utils && apt-get clean all
