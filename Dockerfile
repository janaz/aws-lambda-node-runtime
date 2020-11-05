FROM node:15.1.0-buster-slim@sha256:fc14218ae526b3568ba854732e8fbfe7e67d77769f5c3b17db997983fa571421

RUN apt-get update && apt-get install -y p7zip-full curl xz-utils && apt-get clean all
