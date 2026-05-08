import type { Metadata } from "next";
import "../styles.css";

export const metadata: Metadata = {
  title: "DataForge | Intelligent Dataset Curator",
  description:
    "A pixel-style mock frontend for DataForge, an adaptive dataset repair cockpit for ML engineers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
