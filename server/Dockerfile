# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
# Uploaded images live here; mount a volume to keep them.
RUN mkdir -p server/uploads && chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
