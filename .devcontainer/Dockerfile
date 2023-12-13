# [Choice] Node.js version (use -bookworm, or -bullseye variants on local arm64/Apple Silicon): 20, 18, 20-bookworm, 18-bookworm, 20-bullseye, 18-bullseye, 20-buster, 18-buster
ARG VARIANT=20.10.0-bullseye

FROM node:${VARIANT} AS base

ENV DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,target=/var/cache/ apt update
RUN --mount=type=cache,target=/var/cache/ apt install sudo -y
RUN --mount=type=cache,target=/var/cache/ apt clean
RUN --mount=type=cache,target=/var/cache/ apt autoremove -y

RUN echo node ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/node
RUN chmod 0440 /etc/sudoers.d/node

FROM base

RUN --mount=type=cache,target=/root/.npm npm cache clean --force > /dev/null 2>&1