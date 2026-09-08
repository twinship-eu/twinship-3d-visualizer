import type { NextConfig } from "next";

/**
 * Everything except the build's own hashed assets under /_next/static.
 *
 * Those carry a content hash in the filename, so caching them forever is both
 * safe and desirable; this rule must not touch them.
 */
const NON_HASHED_ASSET_PATTERN = "/:path((?!_next/static).*)";

/**
 * Documents must revalidate on every navigation.
 *
 * Next serves prerendered pages with `s-maxage=31536000`, on the assumption
 * that a CDN in front is purged at deploy time. Ours is not, so a shared cache
 * (ingress, CDN, corporate proxy) could hold a year-old document — and since
 * the document names which hashed chunks to load, that pins a viewer to an
 * entire stale build while colleagues on a cache miss see the current one.
 *
 * The ETag makes the revalidation cheap: unchanged documents come back 304.
 */
const DOCUMENT_CACHE_CONTROL = "public, max-age=0, must-revalidate";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: NON_HASHED_ASSET_PATTERN,
        headers: [{ key: "Cache-Control", value: DOCUMENT_CACHE_CONTROL }],
      },
    ];
  },
};

export default nextConfig;
