import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteResource, saveResource, supportsResource } from '@/api/resources';
import { useAppConfig } from '@/lib/AppConfigContext';
import { useToast } from '@/components/ui/use-toast';
import useCollection from '@/hooks/useCollection';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import FormDialog from '@/components/common/FormDialog';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import AccessDenied from '@/components/common/AccessDenied';
import ListToolbar, { SearchInput } from '@/components/common/ListToolbar';
import { AddButton, FilterSelect, TableFooter } from '@/components/common/TableBits';

/**
 * @typedef {{name: string, label: string, [key: string]: unknown}} ResourceFormField
 * @typedef {{key: string, header: React.ReactNode, width?: number, className?: string, render?: (row: Record<string, unknown>) => React.ReactNode}} ResourceColumn
 * @typedef {{key: string, label: string, options: Array<{value: string, label: string}>, className?: string}} ResourceFilter
 * @param {{
 *   moduleKey: string, title: string, description?: React.ReactNode, entityLabel?: string,
 *   entity: string, fields?: ResourceFormField[], editFields?: ResourceFormField[], columns?: ResourceColumn[],
 *   searchFields?: string[], searchPlaceholder?: string, filters?: ResourceFilter[],
 *   defaultQuery?: Record<string, unknown>, defaultValues?: Record<string, unknown>, sort?: string,
 *   createLabel?: string, emptyTitle?: string, emptyDescription?: string,
 *   emptyIcon?: import("lucide-react").LucideIcon,
 *   rowTo?: (row: Record<string, unknown>) => string,
 *   rowActions?: (row: Record<string, unknown>) => React.ReactNode,
 *   allowDelete?: boolean, allowCreate?: boolean,
 *   transform?: (values: Record<string, unknown>, editing: Record<string, unknown> | null) => Record<string, unknown> | Promise<Record<string, unknown>>,
 *   headerActions?: React.ReactNode, aboveTable?: React.ReactNode, permissionLevel?: string
 * }} props
 */
export default function ResourcePage({
  moduleKey,
  title,
  description,
  entityLabel = 'record',
  entity,
  fields = [],
  editFields,
  columns = [],
  searchFields = [],
  searchPlaceholder = 'Search…',
  filters = [],
  defaultQuery = {},
  defaultValues = {},
  sort = '-created_date',
  createLabel,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  rowTo,
  rowActions,
  allowDelete = true,
  allowCreate = true,
  transform,
  headerActions,
  aboveTable,
  permissionLevel = 'full',
}) {
  const { can } = useAppConfig();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(() => {
    /** @type {Record<string, unknown>} */
    const q = { ...defaultQuery };
    Object.entries(filterValues).forEach(([k, v]) => {
      if (v) q[k] = v;
    });
    if (debounced && searchFields.length === 1) {
      q[searchFields[0]] = { $regex: debounced };
    } else if (debounced && searchFields.length > 1) {
      q.$or = searchFields.map((f) => ({ [f]: { $regex: debounced } }));
    }
    return q;
  }, [JSON.stringify(defaultQuery), JSON.stringify(filterValues), debounced]);

  const { items, total, loading, hasMore, loadMore, reload, error: collectionError } = useCollection(entity, query, {
    sort,
    limit: 50,
  });

  const manage = can(moduleKey, permissionLevel);

  if (!can(moduleKey)) return <AccessDenied moduleName={title} />;

  const handleSubmit = async (values) => {
    const payload = transform ? await transform(values, editing) : values;
    try {
      if (supportsResource(entity)) {
        await saveResource(entity, editing?.id, editing ? payload : { ...defaultValues, ...payload });
        toast({ title: `${entityLabel} ${editing ? 'updated' : 'created'}` });
      } else throw new Error(`${entity} is not available through the custom API.`);
      setEditing(null);
      setOpen(false);
      reload();
    } catch (error) {
      toast({ title: error.message || `Could not save ${entityLabel}`, variant: 'destructive' });
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      if (!supportsResource(entity)) throw new Error(`${entity} is not available through the custom API.`);
      await deleteResource(entity, deleting.id);
      toast({ title: `${entityLabel} deleted` });
      setDeleting(null);
      reload();
    } finally {
      setDeleteBusy(false);
    }
  };

  const allColumns = manage
    ? [
        ...columns,
        {
          key: '__actions',
          header: '',
          width: 96,
          render: (row) => (
            <div className="flex items-center justify-end gap-0.5">
              {rowActions ? rowActions(row) : null}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(row);
                  setOpen(true);
                }}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {allowDelete ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(row);
                  }}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ),
        },
      ]
    : columns;

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {headerActions}
            {manage && allowCreate ? (
              <AddButton
                label={createLabel || `Add ${entityLabel}`}
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              />
            ) : null}
          </>
        }
      />

      {aboveTable}

      <ListToolbar
        right={
          <span className="text-[12px] text-muted-foreground">
            {total === null ? '' : `${total} total`}
          </span>
        }
      >
        {searchFields.length > 0 ? (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={searchPlaceholder}
            className="w-full sm:w-[260px]"
          />
        ) : null}
        {filters.map((f) => (
          <FilterSelect
            key={f.key}
            value={filterValues[f.key]}
            onChange={(v) => setFilterValues((prev) => ({ ...prev, [f.key]: v }))}
            options={f.options}
            placeholder={f.label}
            className={f.className || 'w-[165px]'}
          />
        ))}
      </ListToolbar>

      {collectionError ? <div role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{collectionError.message || 'Could not load records.'}</div> : null}

      <DataTable
        columns={allColumns}
        rows={items}
        loading={loading}
        rowTo={rowTo}
        emptyIcon={emptyIcon}
        emptyTitle={emptyTitle || `No ${entityLabel}s yet`}
        emptyDescription={emptyDescription}
        emptyAction={
          manage && allowCreate ? (
            <AddButton
              label={createLabel || `Add ${entityLabel}`}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            />
          ) : null
        }
        footer={<TableFooter shown={items.length} total={total} hasMore={hasMore} onLoadMore={loadMore} noun={`${entityLabel}s`} />}
      />

      <FormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        title={editing ? `Edit ${entityLabel}` : `New ${entityLabel}`}
        fields={editing && editFields ? editFields : fields}
        initial={editing || defaultValues}
        onSubmit={handleSubmit}
        submitLabel={editing ? 'Save changes' : 'Create'}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => (!v ? setDeleting(null) : null)}
        title={`Delete this ${entityLabel}?`}
        description="This permanently removes the record from the database. This action is recorded in the audit log."
        confirmLabel={deleteBusy ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
