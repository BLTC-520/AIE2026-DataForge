"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

type ConvexClientProviderProps = {
  children: ReactNode;
};

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3210";

const convexClient = new ConvexReactClient(convexUrl);

export default function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const client = useMemo(() => convexClient, []);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
