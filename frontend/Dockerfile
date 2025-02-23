# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Expose the port (e.g., 3000)
EXPOSE 3000

# Start the React application
CMD ["npm", "start"]
