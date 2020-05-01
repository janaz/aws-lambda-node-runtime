FROM node:14.0.0-stretch-slim@sha256:e0601687209fbfa4008d23b6e49a61c0f856e4dab8e686945ff5e616178ce586

RUN apt-get update && apt-get install -y p7zip-full curl xz-utils && apt-get clean all
