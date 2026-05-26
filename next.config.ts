import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0,   // sem cache de RSC para rotas dinâmicas → dados sempre frescos
      static: 300,
    },
  },
};


export default nextConfig;
