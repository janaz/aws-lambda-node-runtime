FROM node:14.4.0-buster-slim@sha256:131acae05a4f622563371c133d05e490e39fa9c2a94a63832b737e3ba84f1136

RUN apt-get update && apt-get install -y advancecomp curl xz-utils && apt-get clean all
