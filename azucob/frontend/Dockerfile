FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
ENV VITE_API_URL=https://azucob-production.up.railway.app
RUN npm run build
RUN npm install -g serve
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "serve dist -s -l $PORT"]
