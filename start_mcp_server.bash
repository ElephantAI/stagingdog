#!/usr/bin/env bash

# Exit if any command fails
set -e

# Name your container (optional but helpful)
CONTAINER_NAME="mcp-server"

# Image name (build this first with `docker build -t $IMAGE_NAME .`)
IMAGE_NAME="stagehand_mcp"

# Host port
HOST_PORT=${HOST_PORT:-3088}

# Get the absolute path to the source directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if  docker ps  | fgrep -q "$CONTAINER_NAME"
then
  echo  "Container $CONTAINER_NAME already running"
else
  # check if it's just stopped
  if  docker ps  -a | fgrep -q "$CONTAINER_NAME"
  then
    docker start "$CONTAINER_NAME"
  else
    # it just does not exist, so run it
    docker run -d \
      --name "$CONTAINER_NAME" \
      --env-file .env \
      -p "$HOST_PORT:3088" \
      -v "$SCRIPT_DIR:/app" \
      "$IMAGE_NAME"
  fi
fi
