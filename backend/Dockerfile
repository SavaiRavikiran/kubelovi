FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port 3006 (backend runs on this port)
EXPOSE 3006

# Start the application
CMD ["npm", "start"]
