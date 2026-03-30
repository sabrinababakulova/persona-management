module.exports = {
  apps: [
    {
      name: "yeshunt",
      script: "bun",
      args: "run start -- -H 127.0.0.1 -p 3000",
      cwd: "/root/projects/persona-management",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        AUTH_URL: process.env.AUTH_URL ?? "https://ilovehr.uz",
      },
    },
  ],
};
