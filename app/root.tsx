import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useOutletContext } from "@remix-run/react";
import { PrismaClient } from "@prisma/client";
import { initializeScheduler } from "~/jobs/scheduler.server";

const prisma = new PrismaClient();

interface RootContext {
  shop: string;
  admin: any; // AdminApiClient from Shopify
}

/**
 * Root loader: Initialize app-wide context and schedulers
 */
export const loader: LoaderFunction = async ({ context }) => {
  const shop = context.shop as string;
  const admin = context.admin;

  // On first load, initialize cron schedulers for all shops
  // This runs once per app boot in production, and respects hot-reload guard in dev
  if (admin) {
    try {
      await initializeScheduler(admin);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Failed to initialize scheduler:", errorMsg);
      // Don't fail the app load, just log the error
    }
  }

  return json({ shop });
};

export default function Root() {
  const context = useOutletContext<RootContext>();
  return null; // Layout is handled by nested routes
}
