# =============================================================================
# Etapa 1: build de TypeScript
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# =============================================================================
# Etapa 2: imagen final (sin devDependencies)
# =============================================================================
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 8082

CMD ["node", "dist/server.js"]
