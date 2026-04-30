FROM node:22-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

FROM node:22-bookworm-slim AS server
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist
WORKDIR /app/server
RUN mkdir -p /app/server/data
EXPOSE 3000
CMD ["node", "index.js"]
