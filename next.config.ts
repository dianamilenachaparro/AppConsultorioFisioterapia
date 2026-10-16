import type { NextConfig } from "next";

const esDesarrollo = process.env.NODE_ENV !== "production";
// Solo con HTTPS real: Safari aplica upgrade-insecure-requests también a http://localhost
// y rompería `pnpm start` en local; HSTS además se ignora sobre HTTP.
const conHttps = process.env.APP_URL?.startsWith("https://") ?? false;

/**
 * CSP compatible con Next.js sin nonces: los scripts de hidratación son en línea, así que
 * script-src necesita 'unsafe-inline'; en desarrollo además 'unsafe-eval' y WebSocket (HMR).
 * Las fuentes se sirven desde el propio dominio (next/font) y no hay recursos de terceros:
 * la conexión con Google es una navegación completa, no una petición desde el navegador.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDesarrollo ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${esDesarrollo ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(conHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const cabecerasSeguridad = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  ...(conHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

// Cache Components queda desactivado a propósito: todas las páginas son
// privadas, dependen de la sesión y muestran datos de salud o finanzas, así que
// se renderizan por solicitud y nunca se guardan en caché.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecerasSeguridad }];
  },
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
