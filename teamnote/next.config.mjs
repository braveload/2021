/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "private, no-store" },
    ];
    return ["/admin-invite/:path*", "/account-recovery/:path*"].map(source => ({ source, headers }));
  },
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
