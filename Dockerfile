FROM ghcr.io/sparfenyuk/mcp-proxy:v0.4.1-alpine

ADD . /app

WORKDIR /app

RUN apk add --update npm

RUN npm ci

RUN npm run build

ENTRYPOINT []

CMD exec mcp-proxy --sse-host=${LISTEN_ADDRESS} --sse-port=${PORT} -e VIKUNJA_API_BASE ${VIKUNJA_API_BASE} -e CREATE_TASK_TOKEN ${CREATE_TASK_TOKEN} -e GET_TASKS_TOKEN ${GET_TASKS_TOKEN} -e TZ ${TZ} -- node ./build/index.js