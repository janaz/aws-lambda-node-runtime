FROM node:15.12.0-buster-slim

RUN apt-get update && apt-get install -y p7zip-full curl xz-utils gnupg && apt-get clean all
