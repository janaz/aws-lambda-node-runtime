FROM node:10.15.3-jessie-slim@sha256:83175f2607e3bf5059cb1a10e7c790735ae6ba1b71fa794c06336293da007291

RUN apt-get update && apt-get install -y p7zip-full curl xz-utils && apt-get clean all

