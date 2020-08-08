FROM node:14.7.0-buster-slim@sha256:d4633e327e0961007b7674b2cee54b65964411ddcd0e441aee43e9c955e44cc2

RUN apt-get update && apt-get install -y p7zip-full curl xz-utils && apt-get clean all
