import React, { useMemo, useState } from "react";
import { Newspaper, ImagePlus } from "lucide-react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import MediaUploadDialog from "@/components/content/MediaUploadDialog";
import useCollection from "@/hooks/useCollection";
import { formatDate, labelize, todayISO } from "@/lib/constants";

const CATEGORIES = {
  player_stories: { label: "Player stories", tone: "green" },
  training_highlights: { label: "Training highlights", tone: "sky" },
  coaching_education: { label: "Coaching education", tone: "purple" },
  centre_news: { label: "Centre news", tone: "navy" },
  league_updates: { label: "League updates", tone: "gold" },
  scholarship_progress: { label: "Scholarship progress", tone: "green" },
  sponsor_impact: { label: "Sponsor impact", tone: "gold" },
  school_project_updates: { label: "School project updates", tone: "amber" },
};

const STORY_STATUS = {
  draft: { label: "Draft", tone: "navy" },
  in_review: { label: "In review", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  published: { label: "Published", tone: "blue" },
  archived: { label: "Archived", tone: "navy" },
};

export default function Stories() {
  const centres = useCollection("Centre", {}, { sort: "name", limit: 100 });
  const [uploading, setUploading] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const centreOptions = useMemo(
    () => centres.items.map((c) => ({ value: c.id, label: c.name })),
    [centres.items],
  );

  const fields = [
    { name: "title", label: "Title", required: true, colSpan: 2 },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      options: Object.keys(CATEGORIES).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "centre_news",
    },
    {
      name: "centre_id",
      label: "Centre",
      type: "select",
      options: centreOptions,
    },
    {
      name: "description",
      label: "Story body / summary",
      type: "textarea",
      colSpan: 2,
      rows: 4,
    },
    {
      name: "publication_date",
      label: "Planned publication date",
      type: "date",
    },
    { name: "author_email", label: "Author email", type: "email" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.keys(STORY_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "draft",
    },
    {
      name: "involves_children",
      label: "Content includes children",
      type: "checkbox",
      colSpan: 2,
      defaultValue: true,
    },
    {
      name: "safeguarding_approved",
      label: "Safeguarding approval granted",
      type: "checkbox",
      colSpan: 2,
      help: "Required before any content involving children can be published.",
    },
    {
      name: "safeguarding_notes",
      label: "Safeguarding notes",
      type: "textarea",
      colSpan: 2,
      rows: 2,
    },
  ];

  const columns = [
    {
      key: "title",
      header: "Story",
      render: (row) => (
        <div className="flex items-start gap-2.5">
          {row.media?.[0]?.file_uri ? (
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
              {row.media.length}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{row.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.centre_name || "Academy-wide"} ·{" "}
              {row.author_email || "No author"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => <StatusBadge value={row.category} map={CATEGORIES} />,
    },
    {
      key: "safeguarding_approved",
      header: "Safeguarding",
      render: (row) =>
        row.safeguarding_approved ? (
          <span className="text-[12px] font-medium text-emerald-700">
            Approved
          </span>
        ) : row.involves_children ? (
          <span className="text-[12px] font-medium text-amber-700">
            Required
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground">Not needed</span>
        ),
    },
    {
      key: "media",
      header: "Media",
      render: (row) =>
        `${(row.media || []).length} file${(row.media || []).length === 1 ? "" : "s"}`,
    },
    {
      key: "publication_date",
      header: "Publish date",
      render: (row) => (
        <span className="text-[12px]">{formatDate(row.publication_date)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={STORY_STATUS} />,
    },
  ];

  const transform = (values, editing) => {
    if (
      values.status === "published" &&
      values.involves_children &&
      !values.safeguarding_approved
    ) {
      throw new Error(
        "Safeguarding approval is required before content involving children can be published.",
      );
    }
    const centre = centres.items.find((c) => c.id === values.centre_id);
    return {
      ...values,
      centre_name: centre?.name || "",
      publication_date:
        values.publication_date ||
        (values.status === "published" ? todayISO() : ""),
      approval_history: (editing?.approval_history || []).concat(
        values.status && values.status !== editing?.status
          ? [
              {
                status: values.status,
                note: "Status changed",
                at: new Date().toISOString(),
                by: "staff",
              },
            ]
          : [],
      ),
    };
  };

  return (
    <>
      <ResourcePage
        key={refreshKey}
        moduleKey="content"
        title="News & Stories"
        description="Internal content management for academy stories. Nothing here is a public website — published items become available to the public API only after approval."
        entityLabel="story"
        entity="Story"
        fields={fields}
        transform={transform}
        columns={columns}
        searchFields={["title", "description"]}
        searchPlaceholder="Search stories…"
        filters={[
          {
            key: "status",
            label: "All statuses",
            options: Object.keys(STORY_STATUS).map((v) => ({
              value: v,
              label: labelize(v),
            })),
          },
          {
            key: "category",
            label: "All categories",
            options: Object.keys(CATEGORIES).map((v) => ({
              value: v,
              label: labelize(v),
            })),
          },
        ]}
        defaultValues={{
          status: "draft",
          involves_children: true,
          category: "centre_news",
        }}
        emptyIcon={Newspaper}
        emptyTitle="No stories yet"
        emptyDescription="Draft a story, attach media, then route it for safeguarding approval."
        rowActions={(row) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setUploading(row);
            }}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Attach media"
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </button>
        )}
      />
      <MediaUploadDialog
        story={uploading}
        open={!!uploading}
        onOpenChange={(v) => (!v ? setUploading(null) : null)}
        onUploaded={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
