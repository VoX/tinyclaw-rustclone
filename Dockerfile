FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY shared/ shared/
COPY server/ server/
COPY client/ client/

RUN npx esbuild client/index.js --bundle --outfile=client/dist/bundle.js --format=esm --minify

EXPOSE 8780

CMD ["node", "server/index.js"]
