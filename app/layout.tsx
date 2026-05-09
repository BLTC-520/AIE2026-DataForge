import type { Metadata } from "next";
// React Flow Basic Setup: https://github.com/xyflow/xyflow/blob/main/packages/react/README.md
import "@xyflow/react/dist/style.css";
import "../styles.css";
import ConvexClientProvider from "../components/convex-provider";

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
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
