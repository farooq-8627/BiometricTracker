FROM node:18-slim

WORKDIR /app

# Copy package files first for better caching
COPY package.json ./

# Force a clean install instead of depending on package-lock.json
RUN npm install --no-package-lock

# Copy the rest of the app
COPY . .

# Set environment variables
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Expose the port
EXPOSE 8080

# Start the application
CMD ["node", "server.js"] 