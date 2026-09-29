import type { MetadataRoute } from "next";

/**
 * What a phone uses when the site is added to the home screen: the name under
 * the icon, the icon itself, and the colour of the bar while it opens.
 *
 * Opens on the dashboard rather than the landing page. Somebody who installed the site
 * is a donor checking their record or their certificate, not a visitor to be
 * pitched to again. Signed out, it sends them to sign in first.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BlooDoc",
    short_name: "BlooDoc",
    description: "Blood donation camps, from the sign-up form to your certificate.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#C41F22",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
