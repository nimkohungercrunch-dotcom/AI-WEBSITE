import type { AdminApiClient } from "@shopify/admin-api-client";

export interface ProductVariant {
  productId: string;
  productTitle: string;
  variantId: string;
  price: string;
  inventoryQuantity: number;
  productType: string;
  vendor: string;
}

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          productType
          vendor
          variants(first: 250) {
            edges {
              node {
                id
                price
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }
`;

const UPDATE_VARIANT_PRICE_MUTATION = `
  mutation UpdateVariantPrice($input: [ProductVariantInput!]!) {
    productVariantsBulkUpdate(input: $input) {
      productVariants {
        id
        price
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Fetch all product variants from Shopify Admin API with pagination.
 * Returns array of { productId, productTitle, variantId, price, inventoryQuantity, productType, vendor }
 * Handles >250 products gracefully via cursor-based pagination.
 */
export async function fetchProducts(
  admin: AdminApiClient
): Promise<ProductVariant[]> {
  const allVariants: ProductVariant[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  try {
    while (hasNextPage) {
      const response = await admin.graphql(PRODUCTS_QUERY, {
        variables: {
          first: 250,
          after: cursor,
        },
      });

      const data = (await response.json()) as any;

      if (data.errors) {
        console.error("GraphQL errors fetching products:", data.errors);
        break;
      }

      const { products } = data.data;

      products.edges.forEach((productEdge: any) => {
        const product = productEdge.node;
        const productId = product.id;
        const productTitle = product.title;
        const productType = product.productType || "";
        const vendor = product.vendor || "";

        product.variants.edges.forEach((variantEdge: any) => {
          const variant = variantEdge.node;
          allVariants.push({
            productId,
            productTitle,
            variantId: variant.id,
            price: variant.price,
            inventoryQuantity: variant.inventoryQuantity || 0,
            productType,
            vendor,
          });
        });
      });

      hasNextPage = products.pageInfo.hasNextPage;
      cursor = products.pageInfo.endCursor;
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }

  return allVariants;
}

export interface UpdatePriceResult {
  success: boolean;
  updatedVariantId?: string;
  error?: string;
}

/**
 * Update a product variant's price using productVariantsBulkUpdate mutation.
 * Returns { success: boolean, error?: string }
 */
export async function updateVariantPrice(
  admin: AdminApiClient,
  variantId: string,
  newPrice: string
): Promise<UpdatePriceResult> {
  try {
    const response = await admin.graphql(UPDATE_VARIANT_PRICE_MUTATION, {
      variables: {
        input: [
          {
            id: variantId,
            price: newPrice,
          },
        ],
      },
    });

    const data = (await response.json()) as any;

    if (data.errors) {
      const errorMsg = data.errors.map((e: any) => e.message).join(", ");
      return {
        success: false,
        error: `GraphQL error: ${errorMsg}`,
      };
    }

    const result = data.data?.productVariantsBulkUpdate;

    if (result?.userErrors && result.userErrors.length > 0) {
      const errorMsg = result.userErrors
        .map((e: any) => `${e.field}: ${e.message}`)
        .join(", ");
      return {
        success: false,
        error: `Shopify error: ${errorMsg}`,
      };
    }

    if (result?.productVariants && result.productVariants.length > 0) {
      return {
        success: true,
        updatedVariantId: variantId,
      };
    }

    return {
      success: false,
      error: "No variants were updated",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Exception: ${errorMsg}`,
    };
  }
}
