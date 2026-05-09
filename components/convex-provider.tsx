"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

type ConvexClientProviderProps = {
  children: ReactNode;
};

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const client = useMemo(() => convexClient, []);

  if (!client) {
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
