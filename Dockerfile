FROM node:alpine
MAINTAINER Eric Eliseo <eric.eliseo@gmail.com>

RUN apk add --update --repository http://dl-3.alpinelinux.org/alpine/edge/testing --no-cache bash vim gcc g++ make  \
    openssh-client \
    git \
    python \
  	&& rm -rf /var/cache/apk/*

ENV LANG en_US.UTF-8

WORKDIR /app