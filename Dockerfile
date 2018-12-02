FROM node:10.14.0-slim@sha256:5aaef0bf16a700696c76e0902241aef6f4067e7e13255bddab835080b4a8ed1b

RUN apt-get update && apt-get install -y p7zip-full curl xz-utils && apt-get clean all

