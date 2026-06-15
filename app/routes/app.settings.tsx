import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  AnnotatedSection,
  Card,
  FormLayout,
  TextField,
  Select,
  TextBlock,
  Button,
  PageActions,
  Banner,
  Box,
} from "@shopify/polaris";
import { useState } from "react";
import { PrismaClient } from "@prisma/client";
import { registerCronJob } from "~/jobs/scheduler.server";

const prisma = new PrismaClient();

export const loader: LoaderFunction = async ({ context }) => {
  const shop = context.shop;
  if (!shop) {
    throw new Error("Shop not found in context");
  }

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
  }

  return json({
    inventoryThreshold: settings.inventoryThreshold,
    maxPriceIncreasePercent: settings.maxPriceIncreasePercent,
    reviewFrequency: settings.reviewFrequency,
    aiBehaviorPrompt: settings.aiBehaviorPrompt || "",
  });
};

export const action: ActionFunction = async ({ request, context }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const shop = context.shop;
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 400 });
  }

  const formData = await request.formData();
  const inventoryThreshold = parseInt(
    formData.get("inventoryThreshold") as string,
    10
  );
  const maxPriceIncreasePercent = parseFloat(
    formData.get("maxPriceIncreasePercent") as string
  );
  const reviewFrequency = formData.get("reviewFrequency") as string;
  const aiBehaviorPrompt = (formData.get("aiBehaviorPrompt") as string) || null;

  // Validate inputs
  if (isNaN(inventoryThreshold) || inventoryThreshold < 0) {
    return json(
      { error: "Inventory Threshold must be a non-negative number" },
      { status: 400 }
    );
  }

  if (isNaN(maxPriceIncreasePercent) || maxPriceIncreasePercent < 0) {
    return json(
      { error: "Max Price Increase must be a non-negative percentage" },
      { status: 400 }
    );
  }

  const validFrequencies = ["hourly", "daily", "weekly", "monthly"];
  if (!validFrequencies.includes(reviewFrequency)) {
    return json(
      { error: "Invalid review frequency" },
      { status: 400 }
    );
  }

  try {
    // Update or create settings
    const updated = await prisma.pricingSettings.upsert({
      where: { shop },
      update: {
        inventoryThreshold,
        maxPriceIncreasePercent,
        reviewFrequency,
        aiBehaviorPrompt,
      },
      create: {
        shop,
        inventoryThreshold,
        maxPriceIncreasePercent,
        reviewFrequency,
        aiBehaviorPrompt,
      },
    });

    // Re-register cron job with new frequency
    const admin = context.admin; // Shopify admin client from context
    if (admin) {
      registerCronJob(shop, admin, reviewFrequency);
    }

    return json({ success: true, settings: updated });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error updating settings for ${shop}:`, errorMsg);
    return json(
      { error: `Failed to save settings: ${errorMsg}` },
      { status: 500 }
    );
  }
};

export default function SettingsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [inventoryThreshold, setInventoryThreshold] = useState(
    String(loaderData.inventoryThreshold)
  );
  const [maxPriceIncreasePercent, setMaxPriceIncreasePercent] = useState(
    String(loaderData.maxPriceIncreasePercent)
  );
  const [reviewFrequency, setReviewFrequency] = useState(
    loaderData.reviewFrequency
  );
  const [aiBehaviorPrompt, setAiBehaviorPrompt] = useState(
    loaderData.aiBehaviorPrompt
  );

  // Calculate example max price for live preview
  const exampleCurrentPrice = 100;
  const maxIncreasePercent = parseFloat(maxPriceIncreasePercent) || 0;
  const exampleMaxPrice = exampleCurrentPrice * (1 + maxIncreasePercent / 100);

  return (
    <Page title="AI Pricing Settings">
      <Layout>
        {/* Success Banner */}
        {actionData?.success && (
          <Layout.Section>
            <Banner status="success" title="Settings saved successfully!">
              Your pricing automation settings have been updated and the cron
              schedule has been re-registered.
            </Banner>
          </Layout.Section>
        )}

        {/* Error Banner */}
        {actionData?.error && (
          <Layout.Section>
            <Banner status="critical" title="Error saving settings">
              {actionData.error}
            </Banner>
          </Layout.Section>
        )}

        {/* Inventory Threshold Section */}
        <Layout.Section>
          <AnnotatedSection
            title="Inventory Threshold"
            description="Pricing automation only applies to products with inventory at or below this level."
          >
            <Card>
              <Form method="post">
                <FormLayout>
                  <TextField
                    label="Inventory Threshold (units)"
                    type="number"
                    value={inventoryThreshold}
                    onChange={setInventoryThreshold}
                    name="inventoryThreshold"
                    min="0"
                    helpText="e.g., 50 means prices only adjust for items with 50 or fewer units in stock"
                  />
                  <TextBlock subdued>
                    📊 Current threshold: {inventoryThreshold} units
                  </TextBlock>
                </FormLayout>
              </Form>
            </Card>
          </AnnotatedSection>
        </Layout.Section>

        {/* Max Price Increase Section */}
        <Layout.Section>
          <AnnotatedSection
            title="Maximum Price Increase Cap"
            description="AI recommendations never exceed this percentage above the current price. This is a safety limit."
          >
            <Card>
              <Form method="post">
                <FormLayout>
                  <TextField
                    label="Maximum Price Increase (%)"
                    type="number"
                    value={maxPriceIncreasePercent}
                    onChange={setMaxPriceIncreasePercent}
                    name="maxPriceIncreasePercent"
                    min="0"
                    helpText="e.g., 50 means a $100 item can never be priced above $150"
                  />
                  <Box paddingBlockStart="200">
                    <TextBlock subdued>
                      💡 <strong>Live Example:</strong>
                    </TextBlock>
                    <TextBlock subdued>
                      Current Price: ${exampleCurrentPrice.toFixed(2)}
                    </TextBlock>
                    <TextBlock subdued>
                      Maximum Price: ${exampleMaxPrice.toFixed(2)}
                    </TextBlock>
                  </Box>
                </FormLayout>
              </Form>
            </Card>
          </AnnotatedSection>
        </Layout.Section>

        {/* Review Frequency Section */}
        <Layout.Section>
          <AnnotatedSection
            title="Review Frequency"
            description="How often the AI pricing cycle runs automatically."
          >
            <Card>
              <Form method="post">
                <FormLayout>
                  <Select
                    label="Automation Schedule"
                    options={[
                      { label: "Hourly (top of every hour)", value: "hourly" },
                      { label: "Daily (3 AM UTC)", value: "daily" },
                      { label: "Weekly (Monday 3 AM UTC)", value: "weekly" },
                      {
                        label: "Monthly (1st of month 3 AM UTC)",
                        value: "monthly",
                      },
                    ]}
                    value={reviewFrequency}
                    onChange={setReviewFrequency}
                    name="reviewFrequency"
                  />
                  <TextBlock subdued>
                    ⏱️ Currently set to: <strong>{reviewFrequency}</strong>
                  </TextBlock>
                </FormLayout>
              </Form>
            </Card>
          </AnnotatedSection>
        </Layout.Section>

        {/* AI Behavior Prompt Section */}
        <Layout.Section>
          <AnnotatedSection
            title="AI Behavior Instructions (Optional)"
            description="Custom instructions for Gemini to personalize pricing recommendations."
          >
            <Card>
              <Form method="post">
                <FormLayout>
                  <TextField
                    label="Custom AI Prompt"
                    type="text"
                    multiline={4}
                    value={aiBehaviorPrompt}
                    onChange={setAiBehaviorPrompt}
                    name="aiBehaviorPrompt"
                    placeholder="e.g., 'Be aggressive with premium products, conservative with budget items. Prioritize margin over volume.'"
                    helpText="Leave blank for default behavior. Your instructions will be included in every pricing recommendation."
                  />
                </FormLayout>
              </Form>
            </Card>
          </AnnotatedSection>
        </Layout.Section>

        {/* Save Button */}
        <Layout.Section>
          <PageActions
            primaryAction={{
              content: "Save Settings",
              onAction: () => {
                // Form will submit via standard POST
                const form = document.querySelector("form");
                if (form) {
                  form.requestSubmit();
                }
              },
            }}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
