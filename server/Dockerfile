FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

ENV PORT=7860
EXPOSE 7860

CMD ["node", "dist/index.js"]
