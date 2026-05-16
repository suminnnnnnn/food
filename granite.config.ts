import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "suminoff", // 콘솔에 입력한 appName을 입력하세요.
  brand: {
    displayName: "Place",
    primaryColor: "#000000",
    icon: "https://static.toss.im/icons/png/4x/icon-toss-logo.png",
  },
  web: {
    port: 3000,
    commands: {
      dev: "npm run dev",
      build: "npm run build",
    },
  },
  permissions: [],
  outdir: "out",
});
