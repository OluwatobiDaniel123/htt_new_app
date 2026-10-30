import React, { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { currency, formatDateTime, labelize } from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import ListToolbar, { SearchInput } from "@/components/common/ListToolbar";
import { FilterSelect, TableFooter } from "@/components/common/TableBits";
import StatusBadge from "@/components/common/StatusBadge";
import AccessDenied from "@/components/common/AccessDenied";
import useCollection from "@/hooks/useCollection";
import { useAppConfig } from "@/lib/AppConfigContext";

export default function Transactions() {
  const { can } = useAppConfig();
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const query = useMemo(() => {
    const q = {};
    if (method) q.method = method;
    if (status) q.status = status;
    return q;
  }, [method, status]);

  const { items, total, loading, hasMore, loadMore } = useCollection(
    "Payment",
    query,
    {
      sort: "-created_date",
      limit: 50,
    },
  );

  if (!can("finance")) return <AccessDenied moduleName="finance" />;

  const rows = items.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (p.payer_name || "").toLowerCase().includes(term) ||
      (p.reference || "").toLowerCase().includes(term) ||
      (p.receipt_number || "").toLowerCase().includes(term) ||
      (p.player_name || "").toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      key: "reference",
      header: "Transaction",
      render: (row) => (
        <div>
          <p className="text-[12.5px] font-medium">
            {row.reference || row.gateway_reference || "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {labelize(row.purpose)}
          </p>
        </div>
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
        <span className="htt-tabular font-medium">{currency(row.amount)}</span>
      ),
    },
    { key: "method", header: "Method", render: (row) => labelize(row.method) },
    {
      key: "paid_at",
      header: "Recorded",
      render: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDateTime(row.paid_at || row.created_date)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: "refund",
      header: "Refund",
      render: (row) =>
        row.refund_amount ? (
          <span className="text-[12px] text-rose-600">
            {currency(row.refund_amount)}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Every recorded payment transaction with method, gateway reference and refund position."
      />
      <ListToolbar
        right={
          <span className="text-[12px] text-muted-foreground">
            {total ?? 0} transactions
          </span>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search payer, reference or receipt…"
          className="w-full sm:w-[280px]"
        />
        <FilterSelect
          value={method}
          onChange={setMethod}
          options={["paystack", "bank_transfer", "cash", "pos", "waiver"].map(
            (v) => ({ value: v, label: labelize(v) }),
          )}
          placeholder="All methods"
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            "pending",
            "paid",
            "failed",
            "refunded",
            "partially_refunded",
          ].map((v) => ({ value: v, label: labelize(v) }))}
          placeholder="All statuses"
        />
      </ListToolbar>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyIcon={ArrowLeftRight}
        emptyTitle="No transactions yet"
        emptyDescription="Payments recorded against registrations appear here."
        footer={
          <TableFooter
            shown={rows.length}
            total={total}
            hasMore={hasMore}
            onLoadMore={loadMore}
            noun="transactions"
          />
        }
      />
    </div>
  );
}
