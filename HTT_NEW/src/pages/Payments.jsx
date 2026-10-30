import React, { useEffect, useState } from "react";
import { Wallet, AlertCircle } from "lucide-react";
import { api } from "@/api/client";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useToast } from "@/components/ui/use-toast";
import { currency, formatDate, labelize, todayISO } from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import DataTable from "@/components/common/DataTable";
import FormDialog from "@/components/common/FormDialog";
import StatusBadge from "@/components/common/StatusBadge";
import AccessDenied from "@/components/common/AccessDenied";
import { AddButton, TableFooter } from "@/components/common/TableBits";
import useCollection from "@/hooks/useCollection";

const PAYMENT_STATUS = {
  pending: { label: "Pending", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  failed: { label: "Failed", tone: "red" },
  refunded: { label: "Refunded", tone: "navy" },
  partially_refunded: { label: "Partially refunded", tone: "gold" },
};

export default function Payments() {
  const { settings, can } = useAppConfig();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [paidTotal, setPaidTotal] = useState(null);
  const payments = useCollection(
    "Payment",
    {},
    { sort: "-created_date", limit: 50 },
  );
  const registrations = useCollection(
    "Registration",
    {},
    { sort: "-created_date", limit: 100 },
  );

  const loadTotals = async () => {
    try {
      const summary = await api.get('/payments/reports/summary');
      setPaidTotal(Number(summary.successfulGross || 0));
    } catch { setPaidTotal(null); }
  };

  useEffect(() => {
    loadTotals();
  }, []);

  if (!can("finance")) return <AccessDenied moduleName="finance" />;
  const manage = can("finance", "full");

  const columns = [
    {
      key: "reference",
      header: "Reference",
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
      header: "Date",
      render: (row) => (
        <span className="text-[12px]">
          {formatDate(row.paid_at || row.created_date)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={PAYMENT_STATUS} />,
    },
    {
      key: "receipt_number",
      header: "Receipt",
      render: (row) => (
        <span className="text-[11.5px] text-muted-foreground">
          {row.receipt_number || "—"}
        </span>
      ),
    },
  ];

  const handleRecord = async (values) => {
    const registration = registrations.items.find(
      (r) => r.id === values.registration_id,
    );
    await api.post('/payments/manual', {
      registrationId: values.registration_id,
      payerName: values.payer_name,
      amount: Number(values.amount),
      method: values.method,
      paidAt: new Date(`${values.paid_at}T12:00:00.000Z`).toISOString(),
      notes: values.notes,
      purpose: values.purpose,
      idempotencyKey: crypto.randomUUID(),
    });
    toast({ title: "Payment recorded" });
    payments.reload();
    loadTotals();
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Registration payments, methods and gateway references. Amounts are validated server-side before a record is written."
        actions={
          manage ? (
            <AddButton label="Record payment" onClick={() => setOpen(true)} />
          ) : null
        }
      />

      {!settings?.paystack_configured ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            Online payment processing is <strong>not yet configured</strong>.
            Manual payments can be recorded and reconciled now; add the Paystack
            secret key to enable card payments.
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total received"
          value={paidTotal === null ? 'Unavailable' : currency(paidTotal)}
          hint={paidTotal === null ? 'Requires finance summary permission' : 'Confirmed payments'}
          icon={Wallet}
          tone="green"
        />
        <StatCard
          label="Payments logged"
          value={payments.total ?? 0}
          hint="All records"
          icon={Wallet}
          tone="navy"
        />
        <StatCard
          label="Pending verification"
          value={payments.items.filter((p) => p.status === "pending").length}
          hint="Awaiting gateway confirmation"
          icon={AlertCircle}
          tone="gold"
        />
      </div>

      <DataTable
        columns={columns}
        rows={payments.items}
        loading={payments.loading}
        emptyIcon={Wallet}
        emptyTitle="No payments recorded"
        emptyDescription="Record a payment against a registration to start the finance ledger."
        footer={
          <TableFooter
            shown={payments.items.length}
            total={payments.total}
            hasMore={payments.hasMore}
            onLoadMore={payments.loadMore}
            noun="payments"
          />
        }
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Record a payment"
        description="Recorded by finance staff. The registration balance updates automatically."
        fields={[
          {
            name: "registration_id",
            label: "Against registration",
            type: "select",
            colSpan: 2,
            options: registrations.items
              .filter((r) => r.status !== "rejected")
              .map((r) => ({
                value: r.id,
                label: `${r.child_name} · ${r.reference || "no ref"} · ${currency(
                  Number(r.amount_due || 0) - Number(r.amount_paid || 0),
                )} outstanding`,
              })),
          },
          { name: "payer_name", label: "Payer name", required: true },
          {
            name: "amount",
            label: "Amount (₦)",
            type: "money",
            required: true,
          },
          {
            name: "method",
            label: "Method",
            type: "select",
            options: ["bank_transfer", "cash", "pos"].map(
              (v) => ({ value: v, label: labelize(v) }),
            ),
            defaultValue: "bank_transfer",
          },
          {
            name: "purpose",
            label: "Purpose",
            type: "select",
            options: [
              "registration",
              "assessment",
              "scholarship_contribution",
              "other",
            ].map((v) => ({ value: v, label: labelize(v) })),
            defaultValue: "registration",
          },
          {
            name: "paid_at",
            label: "Payment date",
            type: "date",
            defaultValue: todayISO(),
          },
          {
            name: "notes",
            label: "Notes",
            type: "textarea",
            colSpan: 2,
            rows: 2,
          },
        ]}
        onSubmit={handleRecord}
        submitLabel="Record payment"
      />
    </div>
  );
}
