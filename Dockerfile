FROM node:15.12.0-buster-slim@sha256:df7835508cc172c02e34b3791ac7a1fd5ce4d0f88ca8915154a966fd4fcae0a5

RUN apt-get update && apt-get install -y p7zip-full curl xz-utils && apt-get clean all
