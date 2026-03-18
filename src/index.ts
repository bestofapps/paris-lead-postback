import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { LeadManager } from "./lead_manager";

type Bindings = {
  API_KEY: string;
  ACTIVE_CAMPAIGN_API_KEY: string;
  DB: D1Database;
};

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// Define the schema for the incoming query parameters
const PostbackQuerySchema = z.object({
  name: z.string().optional().openapi({ description: "name" }),
  origin: z.string().optional().openapi({ description: "origin" }),
  description: z.string().optional().openapi({ description: "description" }),
  carrier: z.string().optional().openapi({ description: "internal user metadata - carrier" }),
  transaction_type: z.string().optional().openapi({ description: "internal generic notification get after receiving payment notification" }),
  referrer: z.string().optional().openapi({ description: "internal referrer domain" }),
  timestamp: z.string().optional().openapi({ description: "internal notification date time" }),
  country_code: z.string().optional().openapi({ description: "internal user metadata - country code" }),
  transaction_id: z.string().optional().openapi({ description: "internal generic notification ID" }),
  tracker_id: z.string().optional().openapi({ description: "internal sub-affiliate ID provided by the affiliate in the campaign link" }),
  currency: z.string().optional().openapi({ description: "internal payout currency configured in the campaign" }),
  payout: z.string().optional().openapi({ description: "internal payout amount" }),
  email: z.string().optional().openapi({ description: "internal user metadata - email" }),
  t1: z.string().optional().openapi({ description: "external : affiliate t1 value provided by the affiliate in the campaign link" }),
  t2: z.string().optional().openapi({ description: "external : affiliate t2 value provided by the affiliate in the campaign link" }),
  t3: z.string().optional().openapi({ description: "external : affiliate t3 value provided by the affiliate in the campaign link" }),
  t4: z.string().optional().openapi({ description: "external : affiliate t4 value provided by the affiliate in the campaign link" }),
  t5: z.string().optional().openapi({ description: "external : affiliate t5 value provided by the affiliate in the campaign link" }),
  sub_id: z.string().optional().openapi({ description: "external : affiliate sub_id value provided by the affiliate in the campaign link" }),
  gclid: z.string().optional().openapi({ description: "external : affiliate gclid value provided by the affiliate in the campaign link" }),
  wbraid: z.string().optional().openapi({ description: "external : affiliate wbraid value provided by the affiliate in the campaign link" }),
  gbraid: z.string().optional().openapi({ description: "external : affiliate gbraid value provided by the affiliate in the campaign link" }),
  pubid: z.string().optional().openapi({ description: "external : affiliate pubid value provided by the affiliate in the campaign link" }),
  click_id: z.string().optional().openapi({ description: "click_id" }),
  campaign_id: z.string().optional().openapi({ description: "campaign ID" }),
  offer_id: z.string().optional().openapi({ description: "offer ID" }),
  ip_address: z.string().optional().openapi({ description: "IP address" }),
  event_type: z.enum(["lead", "sale"]).optional().openapi({ description: "event type: lead or sale" }),
});

// Middleware for API Key Authentication
app.use("/api/postback", async (c, next) => {
  const apiKeyHeader = c.req.header("X-API-Key") || c.req.header("Authorization");
  const validApiKey = c.env.API_KEY;

  if (!apiKeyHeader) {
    return c.json({ error: "Unauthorized: Missing API Key" }, 401);
  }

  const providedKey = apiKeyHeader.startsWith("Bearer ")
    ? apiKeyHeader.slice(7)
    : apiKeyHeader;

  if (providedKey !== validApiKey) {
    return c.json({ error: "Unauthorized: Invalid API Key" }, 401);
  }

  await next();
});

const routeResponses = {
  200: {
    content: {
      "application/json": {
        schema: z.object({
          success: z.boolean(),
          message: z.string(),
          data: PostbackQuerySchema,
        }),
      },
    },
    description: "Successful postback",
  },
  401: {
    content: {
      "application/json": {
          schema: z.object({
              error: z.string()
          })
      }
    },
    description: "Unauthorized"
  }
};

const postbackRoutePost = createRoute({
  method: "post",
  path: "/api/postback",
  request: {
    query: PostbackQuerySchema,
  },
  responses: routeResponses,
  security: [{ APIKeyHeader: [] }, { APIKeyBearer: [] }],
});

const postbackRouteGet = createRoute({
  method: "get",
  path: "/api/postback",
  request: {
    query: PostbackQuerySchema,
  },
  responses: routeResponses,
  security: [{ APIKeyHeader: [] }, { APIKeyBearer: [] }],
});

async function handlePostbackRequest(c: any, method: string) {
  const query = c.req.query();

  // Merge query params and form body (form body takes precedence)
  let formData = {};
  if (method === "POST") {
    try {
      formData = await c.req.parseBody();
    } catch (e) {}
  }
  const params = { ...query, ...formData } as Record<string, string>;

  console.log("Postback received:", JSON.stringify(params));

  const leadManager = new LeadManager(c.env.DB, c.env.ACTIVE_CAMPAIGN_API_KEY);
  const success = await leadManager.processPostback(params);

  if (!success) {
    console.error("LeadManager encountered an error processing the postback");
  }

  return c.json({
    success: true,
    message: "Postback received successfully",
    data: params,
  });
}

app.openapi(postbackRoutePost, async (c) => handlePostbackRequest(c, "POST"));
app.openapi(postbackRouteGet, async (c) => handlePostbackRequest(c, "GET"));

// OpenAPI Spec output
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Paris Lead Postback API",
  },
});

app.openAPIRegistry.registerComponent("securitySchemes", "APIKeyHeader", {
    type: "apiKey",
    in: "header",
    name: "X-API-Key"
});

app.openAPIRegistry.registerComponent("securitySchemes", "APIKeyBearer", {
    type: "http",
    scheme: "bearer"
});

// Swagger UI output
app.get("/ui", swaggerUI({ url: "/doc" }));

export default app;
