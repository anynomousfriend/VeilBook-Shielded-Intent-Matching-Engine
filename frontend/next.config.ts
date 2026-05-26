import type {NextConfig} from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion', '@midnight-ntwrk/midnight-js-indexer-public-data-provider'],
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  webpack: (config, {dev, isServer}) => {
    // Specify that the target environment supports async functions
    // This solves the root cause of the asyncWebAssembly 'async/await' warning
    config.output.environment = {
      ...config.output.environment,
      asyncFunction: true,
    };

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    
    // Force all @midnight-ntwrk packages to resolve from the frontend's
    // node_modules. The contract is linked via file:../contract, so its
    // imports would otherwise walk up to the root workspace node_modules,
    // creating a second ChargedState WASM class that fails instanceof checks.
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
    ];

    config.resolve.alias = {
      ...config.resolve.alias,
      'isomorphic-ws': path.resolve(__dirname, 'lib/ws-polyfill.js'),
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        os: false,
      };
    }

    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
