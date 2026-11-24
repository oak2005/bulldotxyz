/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    config.resolve.alias = {
      ...config.resolve.alias,
      '@x402/evm/upto/client': false,
      '@x402/evm/exact/client': false,
      '@x402/core/client': false,
      '@x402/svm/exact/client': false,
      '@x402/evm': false,
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };

    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /(@x402|pino-pretty|@react-native-async-storage)/,
      })
    );

    return config;
  },
};

module.exports = nextConfig;
