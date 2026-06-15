import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ProductVariant } from "./shopify.server";

export interface PricingSettings {
  inventoryThreshold: number;
  maxPriceIncreasePercent: number;
  aiBehaviorPrompt?: string | null;
}

export interface PriceRecommendation {
  recommendedPrice: number;
  reason: string;
}

/**
 * Get a price recommendation from Google Gemini.
 * Returns { recommendedPrice, reason } or null if response is malformed/invalid.
 * Graceful error handling: malformed responses return null (Rule 4).
 */
export async function getPriceRecommendation(
  product: ProductVariant,
  settings: PricingSettings
): Promise<PriceRecommendation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set in environment");
    return null;
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

    const currentPrice = parseFloat(product.price);
    const maxPrice =
      currentPrice * (1 + settings.maxPriceIncreasePercent / 100);

    const merchantInstructions = settings.aiBehaviorPrompt
      ? `\nMerchant's custom instructions: ${settings.aiBehaviorPrompt}`
      : "";

    const prompt = `You are a pricing optimization AI for an e-commerce store.

Analyze the following product and recommend a new price based on its current low inventory situation.

Product Information:
- Title: ${product.productTitle}
- Type: ${product.productType || "Unknown"}
- Vendor: ${product.vendor || "Unknown"}
- Current Price: $${currentPrice.toFixed(2)}
- Current Inventory: ${product.inventoryQuantity} units
- Inventory Threshold: ${settings.inventoryThreshold} units
- Maximum Allowed Price (absolute cap): $${maxPrice.toFixed(2)}
${merchantInstructions}

Rules:
1. NEVER recommend a price lower than the current price ($${currentPrice.toFixed(2)})
2. NEVER recommend a price above the maximum ($${maxPrice.toFixed(2)})
3. Consider the low inventory and adjust the price to maximize profit while moving excess stock
4. Be strategic: recommend realistic price increases that reflect market demand and scarcity

Respond ONLY with valid JSON in this exact format:
{
  "recommendedPrice": <number>,
  "reason": "<short explanation (1-2 sentences) of why this price is recommended>"
}

Do not include any other text, markdown, or explanations outside the JSON.`;

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.content.parts
      .map((part) => {
        if ("text" in part) {
          return part.text;
        }
        return "";
      })
      .join("");

    if (!responseText) {
      console.error("Empty response from Gemini");
      return null;
    }

    // Parse JSON response
    let recommendation: PriceRecommendation;
    try {
      recommendation = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        `Failed to parse Gemini JSON response: ${responseText}`,
        parseError
      );
      return null;
    }

    // Validate response structure
    if (
      !recommendation ||
      typeof recommendation.recommendedPrice !== "number" ||
      typeof recommendation.reason !== "string"
    ) {
      console.error(
        "Gemini response missing required fields:",
        recommendation
      );
      return null;
    }

    // Validate recommendedPrice is a valid number
    if (
      !isFinite(recommendation.recommendedPrice) ||
      recommendation.recommendedPrice <= 0
    ) {
      console.error(
        "Gemini recommended invalid price:",
        recommendation.recommendedPrice
      );
      return null;
    }

    return recommendation;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Gemini API error: ${errorMsg}`);
    return null;
  }
}
