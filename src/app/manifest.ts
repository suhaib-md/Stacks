import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stacks",
    short_name: "Stacks",
    description: "Your personal book catalogue.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Splash uses paper; the status bar picks up the leather accent.
    background_color: "#faf7f2",
    theme_color: "#8a5a2b",
    orientation: "portrait",
    categories: ["books", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        // Launchers crop this to their own shape, so the mark is inset.
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
