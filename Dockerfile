FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install -g nodemon

COPY . .

ENV NODE_ENV=development

EXPOSE 3000

CMD ["npm", "run", "dev"]

