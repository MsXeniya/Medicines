FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

# `npm ci` требует полного совпадения lockfile. Для лабораторной работы
# используем более терпимую установку, чтобы сборка не падала из-за мелких расхождений.
RUN npm install --no-audit --no-fund

COPY . .

RUN npm run build


FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/build ./build

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

#запуск приложения
CMD ["serve", "-s", "build", "-l", "3000"]
