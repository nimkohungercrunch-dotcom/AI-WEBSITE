import { PrismaClient } from "@prisma/client";
import type { AdminApiClient } from "@shopify/admin-api-client";
import { fetchProducts, updateVariantPrice } from "./shopify.server";
import { getPriceRecommendation } from "./gemini.server";

const prisma = new PrismaClient();

export interface PricingCycleResult {
  product: string;
  productId: string;
  variantId: string;
  oldPrice: number;
  newPrice: number;
  inventory: number;
  reason: string;
  status: "updated" | "skipped_no_increase" | "capped_at_max" | "ai_error";
}

/**
 * Run a complete pricing cycle for a shop.
 * Implements all 4 validation rules:
 * 1. Never exceed max price cap (clamp to cap)
 * 2. Never decrease prices (skip)
 * 3. Filter to inventory threshold
 * 4. Gracefully handle malformed AI responses
 */
export async function runPricingCycle(
  admin: AdminApiClient,
  shop: string
): Promise<PricingCycleResult[]> {
  const results: PricingCycleResult[] = [];

  try {
    // Load settings for this shop (create defaults if none exist)
    let settings = await prisma.pricingSettings.findUnique({
      where: { shop },
    });

    if (!settings) {
      settings = await prisma.pricingSettings.create({
        data: {
          shop,
          inventoryThreshold: 50,
          maxPriceIncreasePercent: 50,
          reviewFrequency: "daily",
        },
      });
      console.log(`Created default PricingSettings for shop: ${shop}`);
    }

    // Fetch all products from Shopify
    console.log(`Fetching products for shop: ${shop}`);
    const allVariants = await fetchProducts(admin);
    console.log(`Fetched ${allVariants.length} product variants`);

    // Rule 3: Filter to variants where inventory <= threshold
    const qualifyingVariants = allVariants.filter(
      (v) => v.inventoryQuantity <= settings!.inventoryThreshold
    );
    console.log(
      `${qualifyingVariants.length} variants qualify (inventory <= ${settings.inventoryThreshold})`
    );

    // Process each qualifying variant
    for (const variant of qualifyingVariants) {
      const currentPrice = parseFloat(variant.price);
      const maxPrice =
        currentPrice * (1 + settings.maxPriceIncreasePercent / 100);

      // Call Gemini for recommendation
      const recommendation = await getPriceRecommendation(variant, {
        inventoryThreshold: settings.inventoryThreshold,
        maxPriceIncreasePercent: settings.maxPriceIncreasePercent,
        aiBehaviorPrompt: settings.aiBehaviorPrompt,
      });

      // Rule 4: Handle malformed responses gracefully
      if (!recommendation) {
        console.warn(
          `AI recommendation failed for variant ${variant.variantId}, skipping`
        );
        results.push({
          product: variant.productTitle,
          productId: variant.productId,
          variantId: variant.variantId,
          oldPrice: currentPrice,
          newPrice: currentPrice,
          inventory: variant.inventoryQuantity,
          reason: "AI service error",
          status: "ai_error",
        });
        continue;
      }

      let recommendedPrice = recommendation.recommendedPrice;

      // Rule 2: Never decrease prices
      if (recommendedPrice < currentPrice) {
        console.log(
          `Skipping ${variant.productTitle}: AI recommended $${recommendedPrice.toFixed(2)} but current is $${currentPrice.toFixed(2)}`
        );
        results.push({
          product: variant.productTitle,
          productId: variant.productId,
          variantId: variant.variantId,
          oldPrice: currentPrice,
          newPrice: currentPrice,
          inventory: variant.inventoryQuantity,
          reason: recommendation.reason,
          status: "skipped_no_increase",
        });
        continue;
      }

      // Rule 1: Never exceed max price cap (clamp instead of reject)
      let cappedAtMax = false;
      if (recommendedPrice > maxPrice) {
        console.log(
          `Capping ${variant.productTitle}: AI recommended $${recommendedPrice.toFixed(2)} but max is $${maxPrice.toFixed(2)}`
        );
        recommendedPrice = maxPrice;
        cappedAtMax = true;
      }

      // If price changed, update it
      if (recommendedPrice !== currentPrice) {
        const updateResult = await updateVariantPrice(
          admin,
          variant.variantId,
          recommendedPrice.toFixed(2)
        );

        if (updateResult.success) {
          // Write to PriceHistory
          await prisma.priceHistory.create({
            data: {
              shop,
              productId: variant.productId,
              variantId: variant.variantId,
              productTitle: variant.productTitle,
              oldPrice: currentPrice,
              newPrice: recommendedPrice,
              inventoryAtChange: variant.inventoryQuantity,
              aiReason: recommendation.reason,
            },
          });

          console.log(
            `Updated ${variant.productTitle}: $${currentPrice.toFixed(2)} → $${recommendedPrice.toFixed(2)}`
          );

          results.push({
            product: variant.productTitle,
            productId: variant.productId,
            variantId: variant.variantId,
            oldPrice: currentPrice,
            newPrice: recommendedPrice,
            inventory: variant.inventoryQuantity,
            reason: recommendation.reason,
            status: cappedAtMax ? "capped_at_max" : "updated",
          });
        } else {
          console.error(
            `Failed to update ${variant.productTitle}: ${updateResult.error}`
          );
          results.push({
            product: variant.productTitle,
            productId: variant.productId,
            variantId: variant.variantId,
            oldPrice: currentPrice,
            newPrice: currentPrice,
            inventory: variant.inventoryQuantity,
            reason: `Update failed: ${updateResult.error}`,
            status: "ai_error",
          });
        }
      }
    }

    console.log(
      `Pricing cycle complete for ${shop}. Updated: ${results.filter((r) => r.status === "updated" || r.status === "capped_at_max").length}/${qualifyingVariants.length}`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error during pricing cycle for ${shop}: ${errorMsg}`);
  }

  return results;
}

/**
 * Get summary statistics for the dashboard.
 * Returns: count of monitored products, count from last cycle, average % change
 */
export async function getPricingSummary(shop: string) {
  try {
    // Get settings
    const settings = await prisma.pricingSettings.findUnique({
      where: { shop },
    });

    if (!settings) {
      return {
        productsMonitored: 0,
        updatedLastCycle: 0,
        avgPriceChange: 0,
      };
    }

    // Get recent price history (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUpdates = await prisma.priceHistory.findMany({
      where: {
        shop,
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    const updateCount = recentUpdates.length;
    const avgChange =
      updateCount > 0
        ? (
            recentUpdates.reduce((sum, record) => {
              const percentChange =
                ((record.newPrice - record.oldPrice) / record.oldPrice) * 100;
              return sum + percentChange;
            }, 0) / updateCount
          ).toFixed(2)
        : "0.00";

    return {
      productsMonitored: 0, // Will be computed in dashboard loader from product fetch
      updatedLastCycle: updateCount,
      avgPriceChange: parseFloat(avgChange),
    };
  } catch (error) {
    console.error(`Error getting pricing summary for ${shop}:`, error);
    return {
      productsMonitored: 0,
      updatedLastCycle: 0,
      avgPriceChange: 0,
    };
  }
}
