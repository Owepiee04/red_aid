import type { MetadataRoute } from "next";

// Lets phones "Add to Home Screen" / "Install app" so RedAid opens full-screen
// like a normal app. Next.js serves this at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RedAid",
    short_name: "RedAid",
    description: "Digital patient care reports for VSU College Red Cross Youth duties",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ed1c24",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
