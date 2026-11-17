import type { MetadataRoute } from "next";

/**
 * Web app manifest: what makes "Add to Home Screen" install the dashboard
 * as its own full-screen app with its own icon (docs/07 §12).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ethan's Dashboard",
    short_name: "Dashboard",
    description: "School, tasks and life in one place.",
    id: "/",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070b14",
    theme_color: "#070b14",
    // Long-press shortcuts on the app icon (where supported).
    shortcuts: [
      { name: "Talk to it", short_name: "Talk", url: "/today?talk=1" },
      { name: "Quick add", short_name: "Add", url: "/today?add=1" },
    ],
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
