import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = "https://akgupta89.github.io";
const pageUrl = `${siteUrl}${basePath}/`;

const title = "Prime Visualizer — Interactive 3D Prime Number Spiral";
const description =
  "Plot the primes on a polar spiral and watch the arms appear. Tune the angle, colour by gap or spiral arm, and test how well a Riemann-R model predicts the next prime.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s — Prime Visualizer",
  },
  description,
  applicationName: "Prime Visualizer",
  authors: [{ name: "Arun Gupta", url: "https://github.com/akgupta89" }],
  creator: "Arun Gupta",
  keywords: [
    "prime numbers",
    "prime spiral",
    "Ulam spiral",
    "number theory",
    "prime gaps",
    "Riemann R function",
    "data visualization",
    "three.js",
    "WebGL",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "Prime Visualizer",
    title,
    description,
    images: [
      {
        url: `${basePath}/og.png`,
        width: 1200,
        height: 630,
        alt: "A prime number spiral with ten colored arms radiating from the origin",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${basePath}/og.png`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050810" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
