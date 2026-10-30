import React, { useState } from "react";
import { Image, ShieldCheck, Send, Undo2 } from "lucide-react";
import { api, fromUiRecord } from "@/api/client";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, labelize, todayISO } from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import AccessDenied from "@/components/common/AccessDenied";
import useCollection from "@/hooks/useCollection";

const STORY_STATUS = {
  draft: { label: "Draft", tone: "navy" },
  in_review: { label: "In review", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  published: { label: "Published", tone: "blue" },
  archived: { label: "Archived", tone: "navy" },
};

export default function MediaApproval() {
  const { can } = useAppConfig();
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);
  const stories = useCollection(
    "Story",
    { status: { $in: ["in_review", "approved"] } },
    { sort: "-created_date", limit: 50 },
  );

  if (!can("content")) return <AccessDenied moduleName="media approval" />;
  const manage = can("content", "full");

  const update = async (row, patch, action, details) => {
    setBusy(row.id);
    try {
      await api.patch(`/stories/${row.id}`, fromUiRecord(patch));
      toast({ title: details });
      stories.reload();
    } catch (error) {
      toast({
        title: error.message || "That action could not be completed",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const publish = async (row) => {
    if (row.involves_children && !row.safeguarding_approved) {
      toast({
        title: "Safeguarding approval required",
        description: "Approve safeguarding before this story can be published.",
        variant: "destructive",
      });
      return;
    }
    await update(
      row,
      {
        status: "published",
        publication_date: row.publication_date || todayISO(),
      },
      "publish_content",
      "Content published",
    );
  };

  const columns = [
    {
      key: "title",
      header: "Story",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {labelize(row.category)} · {row.centre_name || "Academy-wide"}
          </p>
        </div>
      ),
    },
    {
      key: "media",
      header: "Media",
      render: (row) =>
        `${(row.media || []).length} file${(row.media || []).length === 1 ? "" : "s"}`,
    },
    {
      key: "safeguarding",
      header: "Safeguarding",
      render: (row) =>
        row.safeguarding_approved ? (
          <span className="text-[12px] font-medium text-emerald-700">
            Approved
          </span>
        ) : row.involves_children ? (
          <span className="text-[12px] font-medium text-amber-700">
            Awaiting approval
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground">
            No children featured
          </span>
        ),
    },
    {
      key: "publication_date",
      header: "Planned",
      render: (row) => (
        <span className="text-[12px]">{formatDate(row.publication_date)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={STORY_STATUS} />,
    },
    ...(manage
      ? [
          {
            key: "__actions",
            header: "",
            width: 220,
            render: (row) => (
              <div className="flex items-center justify-end gap-1">
                {!row.safeguarding_approved && can("safeguarding", "full") ? (
                  <button
                    disabled={busy === row.id}
                    onClick={() =>
                      update(
                        row,
                        { safeguarding_approved: true, status: "approved" },
                        "safeguarding_approve",
                        "Safeguarding approval granted",
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-40"
                  >
                    <ShieldCheck className="h-3 w-3" /> Approve
                  </button>
                ) : null}
                <button
                  disabled={busy === row.id}
                  onClick={() => publish(row)}
                  className="inline-flex items-center gap-1 rounded-md bg-[#0E7A4F] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#0b6a44] disabled:opacity-40"
                >
                  <Send className="h-3 w-3" /> Publish
                </button>
                <button
                  disabled={busy === row.id}
                  onClick={() =>
                    update(
                      row,
                      { status: "draft" },
                      "return_content",
                      "Returned to draft",
                    )
                  }
                  className="rounded-md border border-border p-1 hover:bg-muted disabled:opacity-40"
                  title="Return to draft"
                >
                  <Undo2 className="h-3 w-3" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Media Approval"
        description="Stories in review or approved but not yet published. Explicit safeguarding approval is required for any content involving children."
      />
      <DataTable
        columns={columns}
        rows={stories.items}
        loading={stories.loading}
        emptyIcon={Image}
        emptyTitle="Nothing awaiting approval"
        emptyDescription="Stories sent for review appear here with safeguarding and publication controls."
      />
    </div>
  );
}
