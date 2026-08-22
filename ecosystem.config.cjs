module.exports = {
  apps: [
    {
      name: "pos-restaurant",
      cwd: __dirname,
      script: "node_modules/.bin/next",
      args: "dev -p 3001",
      env: {
        NODE_ENV: "development",
      },
      autorestart: true,
      max_memory_restart: "500M",
    },
    {
      name: "stock-app",
      cwd: __dirname,
      script: "stock-server.cjs",
      autorestart: true,
      max_memory_restart: "256M",
    },
  ],
};
