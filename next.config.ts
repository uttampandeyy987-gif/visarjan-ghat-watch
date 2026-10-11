import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Partial prerendering (cacheComponents) is incompatible with the nonce-based CSP in src/proxy.ts.
  cacheComponents: false,
  poweredByHeader: false,
  // The dataset is read with fs at runtime; make sure it ships with every server function.
  outputFileTracingIncludes: { "/*": ["./data/**/*"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // JSON endpoints never render HTML: deny everything.
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }] },
    ];
  },
};

export default nextConfig;
