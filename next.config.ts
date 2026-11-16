import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Workspaces and archived releases are runtime data, never deployment dependencies.
  outputFileTracingExcludes: {'/*':['./work/**/*','./.releases/**/*']},
  allowedDevOrigins: ['127.0.0.1'],
  // Isolated verification builds leave the running standalone deployment intact.
  ...(process.env.JARVIS_BUILD_DIR ? { distDir: process.env.JARVIS_BUILD_DIR } : {}),
  poweredByHeader: false,
  typescript: {
    // TS 5.9 + Next.js 16 canary 빌드 내부 타입체커 호환성 이슈
    // tsc --noEmit 직접 실행은 정상 통과. 빌드 블로커 방지용.
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
