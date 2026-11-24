import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MCP_RESOURCE } from "@/lib/oauth";
import { APP_NAME } from "@/lib/site";
import { AssistantSetup } from "@/components/assistant-setup";

export const metadata: Metadata = { title: "Connect your assistant" };

export default async function ConnectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Same filter as /api/user/connections: live, unrevoked connections only.
  const tokens = await prisma.oAuthToken.findMany({
    where: { userId: session.user.id, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
    select: { clientId: true, client: { select: { name: true } } },
  });
  const connected = [...new Map(tokens.map((t) => [t.clientId, t.client.name])).values()];

  return (
      <div className="page-pad">
        <PageHeader
          title="Connect your assistant"
          description={`Connect ${APP_NAME} to Claude or ChatGPT once. Then paste what you're replying to into a chat and ask for a reply. It's written in your voice on your own plan and saved to Drafts, and the ${APP_NAME} extension fills it into the page.`}
        />

        {connected.length > 0 && (
          <div role="status" className="msg ok" style={{ marginBottom: 16 }}>
            Connected: {connected.join(", ")}. You can connect another assistant the same way.
          </div>
        )}

        <AssistantSetup mcpUrl={MCP_RESOURCE} />
      </div>
  );
}
