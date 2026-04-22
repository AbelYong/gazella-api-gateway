FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=development

COPY package.json package-lock.json ./

RUN npm ci

COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/index.js"]