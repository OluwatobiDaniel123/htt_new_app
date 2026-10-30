import React, { useState } from "react";
import { api } from "@/api/client";
import { Receipt as ReceiptIcon, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { currency, formatDate, labelize } from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import ListToolbar, { SearchInput } from "@/components/common/ListToolbar";
import { TableFooter } from "@/components/common/TableBits";
import AccessDenied from "@/components/common/AccessDenied";
import useCollection from "@/hooks/useCollection";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useToast } from "@/components/ui/use-toast";

export default function Receipts() {
  const { can, settings } = useAppConfig();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { items, total, loading, hasMore, loadMore } = useCollection(
    "Payment",
    { status: "paid" },
    { sort: "-paid_at", limit: 50 },
  );

  if (!can("finance")) return <AccessDenied moduleName="finance" />;

  const rows = items.filter((p) => p.receipt_number);
  const filtered = rows.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (p.receipt_number || "").toLowerCase().includes(term) ||
      (p.payer_name || "").toLowerCase().includes(term) ||
      (p.player_name || "").toLowerCase().includes(term)
    );
  });

  const download = async (row) => {
    const receipt = await api.get(`/payments/${row.id}/receipt`);
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(receipt.academy || settings?.academy_name || "HTT Academy", 20, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Official payment receipt", 20, 31);
    doc.setDrawColor(220, 226, 234);
    doc.line(20, 36, 190, 36);

    const lines = [
      ["Receipt number", receipt.receiptNumber || row.receipt_number || "—"],
      ["Transaction reference", receipt.reference || row.reference || row.gateway_reference || "—"],
      ["Payer", receipt.payerName || row.payer_name || "—"],
      ["Player", receipt.playerName || row.player_name || "—"],
      ["Purpose", labelize(row.purpose)],
      ["Method", labelize(row.method)],
      ["Date", formatDate(receipt.paidAt || row.paid_at || row.created_date)],
      ["Currency", receipt.currency || row.currency || "NGN"],
    ];
    let y = 48;
    lines.forEach(([label, value]) => {
      doc.setTextColor(110, 122, 138);
      doc.text(label, 20, y);
      doc.setTextColor(20, 32, 48);
      doc.text(String(value), 80, y);
      y += 8;
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(
      `Amount: ${currency(receipt.amount || row.amount, receipt.currency || row.currency || "NGN")}`,
      20,
      y + 8,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 140, 152);
    doc.text(
      "System generated receipt — HTT Academy Nigeria internal records.",
      20,
      285,
    );
    doc.save(`${receipt.receiptNumber || row.receipt_number}.pdf`);
  };

  const columns = [
    {
      key: "receipt_number",
      header: "Receipt",
      render: (row) => (
        <span className="text-[12.5px] font-medium">{row.receipt_number}</span>
      ),
    },
    {
      key: "payer_name",
      header: "Payer",
      render: (row) => (
        <div>
          <p className="text-[12.5px]">{row.payer_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.player_name || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => (
        <span className="htt-tabular font-medium">
          {currency(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: "purpose",
      header: "Purpose",
      render: (row) => labelize(row.purpose),
    },
    { key: "method", header: "Method", render: (row) => labelize(row.method) },
    {
      key: "paid_at",
      header: "Paid",
      render: (row) => (
        <span className="text-[12px]">
          {formatDate(row.paid_at || row.created_date)}
        </span>
      ),
    },
    {
      key: "__download",
      header: "",
      width: 90,
      render: (row) => (
        <button
          onClick={() => download(row).catch((error) => toast({ title: error.message || 'Could not load receipt details', variant: 'destructive' }))}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11.5px] font-medium hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" /> PDF
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Issued receipts for confirmed payments. Download a PDF copy for the guardian."
      />
      <ListToolbar
        right={
          <span className="text-[12px] text-muted-foreground">
            {rows.length} receipts
          </span>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search receipt, payer or player…"
          className="w-full sm:w-[280px]"
        />
      </ListToolbar>
      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        emptyIcon={ReceiptIcon}
        emptyTitle="No receipts issued"
        emptyDescription="Receipts are generated automatically when a payment is marked paid."
        footer={
          <TableFooter
            shown={filtered.length}
            total={total}
            hasMore={hasMore}
            onLoadMore={loadMore}
            noun="receipts"
          />
        }
      />
    </div>
  );
}
