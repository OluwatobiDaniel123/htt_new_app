import AuthLayout from "@/components/AuthLayout";
import { ShieldAlert } from "lucide-react";

// This legacy MCP consent flow has no equivalent endpoint in the custom API.
// The page is not registered in App.jsx and remains unavailable until a
// supported custom authorization flow is implemented.
export default function OAuthConsent() {
  return (
    <AuthLayout icon={ShieldAlert} title="Authorization unavailable">
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">Authorization unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This authorization flow is not available in the current application.
        </p>
      </div>
    </AuthLayout>
  );
}
