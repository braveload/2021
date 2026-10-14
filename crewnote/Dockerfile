FROM node:22-alpine
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npx next build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
