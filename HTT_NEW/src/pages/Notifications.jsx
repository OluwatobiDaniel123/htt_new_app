import React, { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { api } from '@/api/client';
import { useAppConfig } from '@/lib/AppConfigContext';
import { useToast } from '@/components/ui/use-toast';
import { formatDateTime, labelize } from '@/lib/constants';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import FormDialog from '@/components/common/FormDialog';
import { AddButton } from '@/components/common/TableBits';
import useCollection from '@/hooks/useCollection';
import { cn } from '@/lib/utils';

const TONE = {
  info: 'bg-sky-50 text-sky-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  alert: 'bg-rose-50 text-rose-700',
};

export default function Notifications() {
  const { can } = useAppConfig();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { items, loading, reload } = useCollection('Notification', {}, { sort: '-created_date', limit: 40 });

  const markRead = async (row) => {
    await api.patch(`/notifications/${row.id}/read`, {});
    reload();
  };

  const markAll = async () => {
    const unread = items.filter((n) => !n.read);
    if (unread.length === 0) return;
    await api.patch('/notifications/read-all', {});
    toast({ title: 'All notifications marked read' });
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Internal notices for staff. Unread items are counted in the top bar."
        actions={
          <>
            {isManage(can) ? <AddButton label="New notice" onClick={() => setOpen(true)} /> : null}
            <button
              onClick={markAll}
              className="rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium hover:bg-muted"
            >
              Mark all read
            </button>
          </>
        }
      />

      {loading ? (
        <div className="htt-surface divide-y divide-border/60">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-3">
              <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="htt-surface">
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="System and workflow notices will appear here."
          />
        </div>
      ) : (
        <ul className="htt-surface divide-y divide-border/60">
          {items.map((n) => (
            <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3', !n.read && 'bg-muted/20')}>
              <span className={cn('mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase', TONE[n.type] || TONE.info)}>
                {labelize(n.type || 'info')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{n.title}</p>
                {n.body ? <p className="mt-0.5 text-[12px] text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-[10.5px] text-muted-foreground/80">{formatDateTime(n.created_date)}</p>
              </div>
              {!n.read ? (
                <button
                  onClick={() => markRead(n)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Mark as read"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="New staff notice"
        fields={[
          { name: 'title', label: 'Title', required: true, colSpan: 2 },
          { name: 'body', label: 'Message', type: 'textarea', colSpan: 2, rows: 3 },
          { name: 'link', label: 'Link (optional)', placeholder: '/registrations' },
        ]}
        onSubmit={async (values) => {
          await api.post('/admin/notifications/announcements', { ...values, idempotencyKey: crypto.randomUUID() });
          toast({ title: 'Notice published' });
          reload();
        }}
        submitLabel="Publish notice"
      />
    </div>
  );
}

function isManage(can) {
  return can('notifications', 'full');
}
