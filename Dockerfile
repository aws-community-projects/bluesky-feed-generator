FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy the rest of the application code to the container
COPY . .

RUN npm install

# Expose the port your application listens on (replace 3000 with your port if needed)
EXPOSE 3000

# Specify the command to run your application
CMD ["npx", "ts-node", "bluesky-feed-parser/app.ts"]