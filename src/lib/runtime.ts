/** Shared Demo/Live runtime constants — safe for client and server bundles. */

export const RUNTIME_HEADER = "x-monapi-runtime";
/** Cookie that carries the demo catalog across serverless instances. */
export const DEMO_STORE_COOKIE = "monapi_demo_store";

export type Experience = "publisher" | "subscriber";
export type RuntimeMode = "demo" | "live";
