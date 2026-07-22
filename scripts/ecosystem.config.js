module.exports = {
  apps: [
    {
      name: "yeshunt",
      script: "bun",
      args: "run start",
      cwd: "/root/projects/persona-management",
      env: {
        NODE_ENV: "production",
        AUTH_URL: process.env.AUTH_URL ?? "https://admin.talanty.uz",
      },
    },
  ],
};
