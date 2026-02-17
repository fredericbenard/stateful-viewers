# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Ensure public profiles are in the image ( .dockerignore excludes data but allows data/profiles/public )
COPY data/profiles/public ./data/profiles/public
RUN npm run build

# Run stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
# All profiles under data/profiles/public (for HF loadable demos)
COPY --from=builder /app/data/profiles/public ./data/profiles/public
EXPOSE 7860
ENV PORT=7860
CMD ["node", "server/index.js"]
