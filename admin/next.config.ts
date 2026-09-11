import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without this, Next.js walks up
  // looking for a lockfile and can land on an unrelated one higher up the
  // filesystem (e.g. in the user's home directory), which breaks dev-time
  // module resolution — the root layout silently fails to render (sidebar
  // and all) while individual pages still come through.
  outputFileTracingRoot: path.join(__dirname),
  // The dev-mode route/segment explorer overlay throws a React Client
  // Manifest resolution error in this environment and takes the whole
  // root layout down with it (sidebar included) while leaving the page
  // content rendering standalone. Turning the dev indicator off avoids
  // loading that overlay.
  devIndicators: false,
};

export default nextConfig;
