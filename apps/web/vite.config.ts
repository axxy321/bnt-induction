import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  return {
    plugins: [
      // main.tsx only mounts the application and exports no components. Keep it
      // out of Fast Refresh boundary checks; Vite will reload the page when the
      // bootstrap itself changes, while component modules continue to refresh.
      react({ exclude: /src\/main\.tsx$/ }),


      VitePWA({
        selfDestroying: true
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            supabase: ["@supabase/supabase-js"],
            motion: ["framer-motion"]
          }
        }
      }
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true
        }
      }
    }
  };
});
