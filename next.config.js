/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false,
      canvas: false,
      encoding: false
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding', 'canvas');
    
    // Handle Tesseract.js worker files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    
    // Handle large OCR worker files
    config.module.rules.push({
      test: /tesseract\.js/,
      use: {
        loader: 'file-loader',
        options: {
          publicPath: '/_next/static/chunks/',
          outputPath: 'static/chunks/',
        },
      },
    });

    return config;
  },
  
  // Configure static file serving for OCR assets
  async headers() {
    return [
      {
        source: '/_next/static/chunks/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
