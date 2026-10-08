import { createAnalysisGateway } from "@/features/analysis/server";
import { invokeBackend } from "@/lib/aws-runtime.mjs";
// Server-only configuration. No credential or access secret is NEXT_PUBLIC.
export const gateway = createAnalysisGateway({
  // Logical fixed-path contract; invokeBackend uses IAM Lambda Invoke, not API Gateway.
  baseUrl: "https://lambda-backend.invalid",
  backendToken: process.env.JALDRISHTI_BACKEND_TOKEN ?? "",
  accessCode: process.env.JALDRISHTI_ACCESS_CODE ?? "",
  sessionSecret: process.env.JALDRISHTI_SESSION_SECRET ?? "",
  origin: process.env.JALDRISHTI_FRONTEND_ORIGIN,
  fetcher: (url, init) => invokeBackend(String(url), init),
});
