FROM node:22-alpine

WORKDIR /app

# Ensure correct permissions for the app directory
RUN chown -R node:node /app

USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --only=production

COPY --chown=node:node . .

RUN npm run build

ENV PORT=7860
EXPOSE 7860

CMD ["node", "dist/index.js"]
