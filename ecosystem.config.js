module.exports = {
  apps: [
    {
      name: "adforge",
      script: "server.js", // root custom server — includes hourly node-cron autopilot
      env: {
        NODE_ENV: "production",
        PORT: 3010,
      },
    },
  ],
};
