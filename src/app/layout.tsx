import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prime Visualizer",
  description: "Visualize and discover the beauty of prime numbers.",
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
