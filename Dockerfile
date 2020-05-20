FROM node:14.2.0-stretch-slim@sha256:5c4c0dd64aac04572904870a83ab1465e4b06b9b3a2f896b10b3d7a3ed83a8c6

RUN apt-get update && apt-get install -y advancecomp curl xz-utils && apt-get clean all
