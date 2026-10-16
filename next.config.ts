import type { NextConfig } from "next";

// Cache Components queda desactivado a propósito: todas las páginas son
// privadas, dependen de la sesión y muestran datos de salud o finanzas, así que
// se renderizan por solicitud y nunca se guardan en caché.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
