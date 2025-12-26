FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Copy .env.example as default .env
RUN cp .env.example .env

# Create data and images directories
RUN mkdir -p data public/images

# Expose port
EXPOSE 8045

# Start application
CMD ["sh", "-c", "node src/config/init-env.js && npm start"]