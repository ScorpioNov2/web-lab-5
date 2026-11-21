# --- ЭТАП 1: Сборка Analog (Vite + Nitro) ---
FROM node:24.18.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@11.18.0 && npm ci
# Папка public/ (картинки темы) копируется вместе с остальным кодом
COPY . .
RUN npm run build

# --- ЭТАП 2: Node-сервер Nitro, который выполняет SSR ---
FROM node:24.18.0-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    # Адрес Java-backend во внутренней сети Docker (используется сервером, не браузером)
    BACKEND_URL=http://backend:8080 \
    BACKEND_API_PATH=/api

# Сборка Nitro самодостаточна: server/index.mjs + public/ (node_modules не нужны)
COPY --from=build /app/dist/analog ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/login > /dev/null || exit 1

CMD ["node", "server/index.mjs"]
