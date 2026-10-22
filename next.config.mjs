/** @type {import('next').NextConfig} */
const nextConfig = {
  // Statik çıktı: `npm run build` -> `out/`. Canlıda Caddy sunar ve /api'yi PostgREST'e iletir.
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
