import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Offline mode (docs/offline-mode.md): keep the pages already loaded in
    // this tab for up to 12 hours, so moving between Home and New Report still
    // works when the signal drops. Every page here loads its data in the
    // browser, so this only keeps the page layout, not old data. Without it,
    // Next.js forgets pages after 5 minutes and, with no signal, the phone
    // shows its "No internet" error page instead of RedAid.
    staleTimes: { static: 12 * 60 * 60 },
  },
};

export default nextConfig;
