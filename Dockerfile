# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Ensure public artifacts are in the image ( .dockerignore excludes data but allows public subdirs )
COPY data/profiles/public ./data/profiles/public
COPY data/styles/public ./data/styles/public
COPY data/states/public ./data/states/public
RUN npm run build

# Run stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
# All public artifacts (for HF loadable demos)
COPY --from=builder /app/data/profiles/public ./data/profiles/public
COPY --from=builder /app/data/styles/public ./data/styles/public
COPY --from=builder /app/data/states/public ./data/states/public
EXPOSE 7860
ENV PORT=7860
CMD ["node", "server/index.js"]
