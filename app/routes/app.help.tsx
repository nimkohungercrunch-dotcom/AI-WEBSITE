import { Page, Layout, Card, Text, Link, Box, List } from "@shopify/polaris";

export default function HelpPage() {
  return (
    <Page title="Help & Documentation">
      <Layout>
        {/* Overview Section */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h2" variant="headingLg">
                🚀 AI Dynamic Pricing Assistant
              </Text>
              <Text as="p" variant="bodyMd" color="subdued">
                An intelligent pricing automation system that uses Google Gemini AI
                to dynamically adjust product prices based on inventory levels,
                market conditions, and merchant preferences.
              </Text>
            </Box>
          </Card>
        </Layout.Section>

        {/* How It Works Section */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h3" variant="headingMd">
                📖 How It Works
              </Text>
              <Box paddingBlockStart="300">
                <List>
                  <List.Item>
                    <strong>Filter by Inventory:</strong> Only products with
                    inventory at or below your threshold are considered for
                    repricing.
                  </List.Item>
                  <List.Item>
                    <strong>AI Recommendation:</strong> Gemini analyzes each
                    product and recommends a new price based on AI-driven insights.
                  </List.Item>
                  <List.Item>
                    <strong>Validation Rules:</strong> Prices never decrease,
                    never exceed your max cap, and always apply AI reasoning.
                  </List.Item>
                  <List.Item>
                    <strong>Shopify Update:</strong> Approved prices are
                    immediately updated in Shopify.
                  </List.Item>
                  <List.Item>
                    <strong>Audit Trail:</strong> Every change is logged for
                    review and analysis.
                  </List.Item>
                </List>
              </Box>
            </Box>
          </Card>
        </Layout.Section>

        {/* Configuration Guide Section */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h3" variant="headingMd">
                ⚙️ Configuration Guide
              </Text>
              <Box paddingBlockStart="300">
                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    1. Inventory Threshold
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    Only products with inventory at or below this level will be
                    repriced. Example: Set to 50 to auto-price items with 50 or
                    fewer units.
                  </Text>
                </Box>

                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    2. Maximum Price Increase
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    A safety cap preventing prices from increasing beyond this
                    percentage. Example: Set to 50% means a $100 item caps at
                    $150, even if AI recommends higher.
                  </Text>
                </Box>

                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    3. Review Frequency
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    How often pricing cycles run automatically:
                  </Text>
                  <List>
                    <List.Item>Hourly: Top of every hour</List.Item>
                    <List.Item>Daily: 3 AM UTC (default)</List.Item>
                    <List.Item>Weekly: Monday 3 AM UTC</List.Item>
                    <List.Item>Monthly: 1st of month 3 AM UTC</List.Item>
                  </List>
                </Box>

                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    4. AI Behavior Prompt (Optional)
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    Custom instructions for Gemini. Example:
                  </Text>
                  <Text
                    as="p"
                    variant="bodySm"
                    color="subdued"
                    fontFamily="mono"
                  >
                    "Be aggressive with premium products, conservative with
                    budget items. Prioritize margin over volume."
                  </Text>
                </Box>
              </Box>
            </Box>
          </Card>
        </Layout.Section>

        {/* Validation Rules Section */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h3" variant="headingMd">
                ✅ Safety & Validation Rules
              </Text>
              <Box paddingBlockStart="300">
                <List>
                  <List.Item>
                    <strong>Rule 1 - Never Exceed Max Cap:</strong> If AI
                    recommends $150 but your cap is $140, price is clamped to
                    $140 (not rejected).
                  </List.Item>
                  <List.Item>
                    <strong>Rule 2 - Never Decrease Prices:</strong> If current
                    price is $100 and AI recommends $90, the product is skipped
                    (prices only go up or stay the same).
                  </List.Item>
                  <List.Item>
                    <strong>Rule 3 - Filter by Inventory:</strong> Only products
                    below your threshold are eligible for repricing.
                  </List.Item>
                  <List.Item>
                    <strong>Rule 4 - Graceful AI Error Handling:</strong> If
                    Gemini fails or returns malformed data, the product is
                    skipped without breaking the cycle.
                  </List.Item>
                </List>
              </Box>
            </Box>
          </Card>
        </Layout.Section>

        {/* Dashboard Features Section */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h3" variant="headingMd">
                📊 Dashboard Features
              </Text>
              <Box paddingBlockStart="300">
                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    Summary Cards
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    Real-time metrics:
                  </Text>
                  <List>
                    <List.Item>Monitored Products: Count of items below threshold</List.Item>
                    <List.Item>Updated Last 24h: Price changes in the past day</List.Item>
                    <List.Item>Average Price Change: Mean % increase</List.Item>
                  </List>
                </Box>

                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    Manual Pricing Check
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    Click "Run Pricing Check Now" to trigger a cycle immediately
                    (useful for testing or urgent updates).
                  </Text>
                </Box>

                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    Price History Tab
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    Complete audit trail of all price changes from the last 7
                    days, including old/new prices, inventory, AI reasoning, and
                    timestamps.
                  </Text>
                </Box>
              </Box>
            </Box>
          </Card>
        </Layout.Section>

        {/* Troubleshooting Section */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h3" variant="headingMd">
                🔧 Troubleshooting
              </Text>
              <Box paddingBlockStart="300">
                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    No products are being repriced
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    Check your inventory threshold setting. It's likely too low.
                    Increase it so more products qualify.
                  </Text>
                </Box>

                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    Prices seem too aggressive
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    Lower your "Max Price Increase" percentage or add custom AI
                    instructions in settings to be more conservative.
                  </Text>
                </Box>

                <Box paddingBlockEnd="300">
                  <Text as="h4" variant="headingSm">
                    AI recommendations are failing (status: ai_error)
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued">
                    Check that your Google Gemini API key is valid and has
                    sufficient quota. See your server logs for details.
                  </Text>
                </Box>
              </Box>
            </Box>
          </Card>
        </Layout.Section>

        {/* Support Section */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h3" variant="headingMd">
                💬 Support
              </Text>
              <Text as="p" variant="bodySm" color="subdued">
                For issues or questions, refer to the documentation or contact
                support. Check your server logs for detailed error messages.
              </Text>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
