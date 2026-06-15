import cron from "node-cron";
import type { AdminApiClient } from "@shopify/admin-api-client";
import { runPricingCycle } from "../services/pricing.server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Global store for active cron jobs per shop
const activeJobs = new Map<string, cron.ScheduledTask>();

// Guard against Remix hot-reload starting multiple jobs in dev
let isInitialized = false;

export interface CronSchedule {
  hourly: string;
  daily: string;
  weekly: string;
  monthly: string;
}

// Cron patterns for each review frequency
const CRON_PATTERNS: CronSchedule = {
  hourly: "0 * * * *", // top of every hour
  daily: "0 3 * * *", // 3 AM UTC daily
  weekly: "0 3 * * 1", // Monday 3 AM UTC
  monthly: "0 3 1 * *", // 1st of month 3 AM UTC
};

/**
 * Get the cron pattern for a given frequency string.
 * Defaults to daily if frequency is not recognized.
 */
function getCronPattern(
  frequency: string
): string {
  const pattern =
    CRON_PATTERNS[frequency as keyof CronSchedule] || CRON_PATTERNS.daily;
  return pattern;
}

/**
 * Create a pricing cycle job for a shop.
 * Returns a scheduled task that can be stopped.
 */
function createPricingJob(
  shop: string,
  admin: AdminApiClient,
  pattern: string
): cron.ScheduledTask {
  return cron.schedule(pattern, async () => {
    console.log(`[Cron] Running pricing cycle for shop: ${shop}`);
    try {
      await runPricingCycle(admin, shop);
      console.log(`[Cron] Pricing cycle completed for shop: ${shop}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[Cron] Pricing cycle failed for shop ${shop}: ${errorMsg}`
      );
    }
  });
}

/**
 * Register a cron job for a shop based on its PricingSettings.
 * Stops any existing job and starts a new one.
 */
export function registerCronJob(
  shop: string,
  admin: AdminApiClient,
  frequency: string
): void {
  // Stop existing job if it exists
  if (activeJobs.has(shop)) {
    const existingJob = activeJobs.get(shop);
    if (existingJob) {
      existingJob.stop();
      console.log(`[Scheduler] Stopped existing cron job for shop: ${shop}`);
    }
  }

  // Create and register new job
  const pattern = getCronPattern(frequency);
  const newJob = createPricingJob(shop, admin, pattern);
  activeJobs.set(shop, newJob);

  console.log(
    `[Scheduler] Registered cron job for shop: ${shop} (frequency: ${frequency}, pattern: ${pattern})`
  );
}

/**
 * Unregister and stop a cron job for a shop.
 */
export function unregisterCronJob(shop: string): void {
  if (activeJobs.has(shop)) {
    const job = activeJobs.get(shop);
    if (job) {
      job.stop();
      activeJobs.delete(shop);
      console.log(`[Scheduler] Unregistered cron job for shop: ${shop}`);
    }
  }
}

/**
 * Initialize all cron jobs from the database.
 * Call this once on app boot.
 * Guards against hot-reload by checking isInitialized flag.
 */
export async function initializeScheduler(
  admin: AdminApiClient
): Promise<void> {
  // Guard against Remix hot-reload in dev
  if (isInitialized) {
    console.log("[Scheduler] Already initialized, skipping (hot-reload guard)");
    return;
  }

  isInitialized = true;

  try {
    console.log("[Scheduler] Initializing cron jobs from database...");

    // Load all shops with pricing settings
    const allSettings = await prisma.pricingSettings.findMany();

    if (allSettings.length === 0) {
      console.log("[Scheduler] No shops found in database, no jobs to initialize");
      return;
    }

    // Register a job for each shop
    allSettings.forEach((settings) => {
      registerCronJob(settings.shop, admin, settings.reviewFrequency);
    });

    console.log(
      `[Scheduler] Initialized ${allSettings.length} cron job(s)`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Scheduler] Initialization error: ${errorMsg}`);
  }
}

/**
 * Stop all active cron jobs.
 * Call this on app shutdown or for cleanup.
 */
export function stopAllSchedulers(): void {
  activeJobs.forEach((job, shop) => {
    job.stop();
    console.log(`[Scheduler] Stopped cron job for shop: ${shop}`);
  });
  activeJobs.clear();
  console.log("[Scheduler] All cron jobs stopped");
}

/**
 * Get the currently active cron patterns for debugging/status.
 */
export function getSchedulerStatus(): Record<string, string> {
  const status: Record<string, string> = {};
  activeJobs.forEach((job, shop) => {
    status[shop] = job.status === "started" ? "active" : "stopped";
  });
  return status;
}
