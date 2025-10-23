FROM node:20-alpine AS build

WORKDIR /app/web/console

COPY package.json /app/package.json
COPY web/console/package.json ./package.json
COPY web/console/package-lock.json ./package-lock.json
RUN npm ci

COPY web/console/tsconfig.json ./tsconfig.json
COPY web/console/vite.config.ts ./vite.config.ts
COPY web/console/vitest.config.ts ./vitest.config.ts
COPY web/console/vitest.setup.ts ./vitest.setup.ts
COPY web/console/index.html ./index.html
COPY web/console/src ./src

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/web/console/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
