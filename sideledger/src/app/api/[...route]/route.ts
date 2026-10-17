import { handler } from "@/server/cloud-route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = handler,
  POST = handler,
  PUT = handler,
  PATCH = handler,
  DELETE = handler;
