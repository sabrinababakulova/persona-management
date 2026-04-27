import { definePreview } from "@storybook/nextjs-vite";

import "../src/styles/globals.css";

export default definePreview({
  parameters: {
    backgrounds: {
      default: "app",
      options: {
        app: { name: "app", value: "#f9fafb" },
        sidebar: { name: "sidebar", value: "#1a1a1a" },
        white: { name: "white", value: "#ffffff" },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
});
