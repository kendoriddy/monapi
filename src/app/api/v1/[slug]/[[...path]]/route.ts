import { handleGatewayRequest } from "@/lib/gateway";

type Params = { slug: string; path?: string[] };

async function dispatch(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { slug, path } = await context.params;
  return handleGatewayRequest(request, slug, path);
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
