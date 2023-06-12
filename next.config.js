/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/cv',
        destination: '/cv_en.pdf',
        permanent: true,
      },
      {
        source: '/cv-de',
        destination: '/cv_de.pdf',
        permanent: true,
      },
    ]
  },
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
