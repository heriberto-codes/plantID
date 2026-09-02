FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000

WORKDIR /app

COPY --chown=node:node package.json server.js index.html script.js style.css ./
COPY --chown=node:node assets ./assets

USER node

EXPOSE 8000

CMD ["node", "server.js"]
