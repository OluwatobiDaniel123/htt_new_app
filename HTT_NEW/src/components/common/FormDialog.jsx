import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const emptyFor = (field) => {
  if (field.type === 'checkbox') return false;
  if (field.type === 'multiselect') return [];
  if (field.type === 'number' || field.type === 'money') return '';
  return '';
};

const buildInitial = (fields, initial) => {
  const base = {};
  fields.forEach((f) => {
    const raw = initial?.[f.name];
    if (raw === undefined || raw === null) {
      base[f.name] = f.defaultValue !== undefined ? f.defaultValue : emptyFor(f);
    } else if (f.type === 'checkbox') {
      base[f.name] = !!raw;
    } else if (f.type === 'multiselect') {
      base[f.name] = Array.isArray(raw) ? raw : [];
    } else if (f.type === 'string-array') {
      base[f.name] = Array.isArray(raw) ? raw.join('\n') : '';
    } else if (f.type === 'datetime') {
      base[f.name] = String(raw).slice(0, 16);
    } else {
      base[f.name] = raw;
    }
  });
  return base;
};

export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields = [],
  initial,
  onSubmit,
  submitLabel = 'Save',
  columns = 2,
  size = 'max-w-2xl',
}) {
  const [values, setValues] = useState(() => buildInitial(fields, initial));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(buildInitial(fields, initial));
      setError('');
    }
  }, [open, JSON.stringify(initial), JSON.stringify(fields.map((f) => f.name))]);

  const setValue = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const missing = fields.find((f) => {
      if (!f.required) return false;
      const v = values[f.name];
      if (f.type === 'checkbox') return v !== true;
      if (f.type === 'multiselect') return !Array.isArray(v) || v.length === 0;
      return v === '' || v === null || v === undefined;
    });
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    const payload = {};
    fields.forEach((f) => {
      let v = values[f.name];
      if (f.type === 'number' || f.type === 'money') {
        v = v === '' || v === null || v === undefined ? undefined : Number(v);
      }
      if (f.type === 'string-array') {
        v = String(v || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      }
      if (typeof v === 'string') v = v.trim();
      if (v !== undefined && v !== '') payload[f.name] = v;
      if (v === '' || v === undefined) {
        if (f.type === 'number' || f.type === 'money') {
          delete payload[f.name];
        } else if (f.clearable !== false && f.type !== 'checkbox') {
          payload[f.name] = f.type === 'multiselect' ? [] : '';
        }
      }
      if (f.type === 'checkbox') payload[f.name] = !!values[f.name];
      if (f.type === 'multiselect') payload[f.name] = values[f.name] || [];
      if (f.type === 'string-array') payload[f.name] = v;
    });
    setSaving(true);
    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Could not save this record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const grouped = fields.reduce((acc, f) => {
    const key = f.section || '__main';
    acc[key] = acc[key] || [];
    acc[key].push(f);
    return acc;
  }, {});

  const renderField = (f) => {
    const id = `field-${f.name}`;
    const common = {
      id,
      value: values[f.name] ?? '',
      onChange: (e) => setValue(f.name, e.target.value),
      placeholder: f.placeholder || '',
      disabled: saving || !!f.disabled,
    };
    const colSpan = f.colSpan === 2 ? 'sm:col-span-2' : '';

    return (
      <div key={f.name} className={`space-y-1.5 ${colSpan}`}>
        {f.type !== 'checkbox' ? (
          <Label htmlFor={id} className="text-[12px] font-medium text-foreground/80">
            {f.label} {f.required ? <span className="text-rose-500">*</span> : null}
          </Label>
        ) : null}

        {f.type === 'textarea' || f.type === 'string-array' ? (
          <Textarea {...common} rows={f.rows || 3} className="text-[13px]" />
        ) : f.type === 'select' ? (
          <Select
            value={values[f.name] || ''}
            onValueChange={(v) => setValue(f.name, v)}
            disabled={saving || !!f.disabled}
          >
            <SelectTrigger className="h-9 text-[13px]">
              <SelectValue placeholder={f.placeholder || 'Select…'} />
            </SelectTrigger>
            <SelectContent>
              {(f.options || []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-[13px]">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : f.type === 'checkbox' ? (
          <label
            htmlFor={id}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 px-3 py-2.5"
          >
            <Checkbox
              id={id}
              checked={!!values[f.name]}
              onCheckedChange={(c) => setValue(f.name, c === true)}
              disabled={saving || !!f.disabled}
              className="mt-0.5"
            />
            <span className="text-[12.5px] leading-snug text-foreground/85">
              {f.label}
              {f.help ? (
                <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{f.help}</span>
              ) : null}
            </span>
          </label>
        ) : f.type === 'multiselect' ? (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/80 p-2">
            {(f.options || []).length === 0 ? (
              <p className="px-1 py-1 text-[12px] text-muted-foreground">No options available</p>
            ) : (
              (f.options || []).map((opt) => {
                const checked = (values[f.name] || []).includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) =>
                        setValue(
                          f.name,
                          c === true
                            ? [...(values[f.name] || []), opt.value]
                            : (values[f.name] || []).filter((v) => v !== opt.value)
                        )
                      }
                      disabled={saving || !!f.disabled}
                    />
                    <span className="text-[12.5px]">{opt.label}</span>
                  </label>
                );
              })
            )}
          </div>
        ) : (
          <Input
            {...common}
            type={
              f.type === 'money' || f.type === 'number'
                ? 'number'
                : f.type === 'datetime'
                  ? 'datetime-local'
                  : f.type || 'text'
            }
            step={f.type === 'money' ? '0.01' : f.step}
            min={f.min}
            max={f.max}
            className="h-9 text-[13px]"
          />
        )}
        {f.help && f.type !== 'checkbox' ? (
          <p className="text-[11px] text-muted-foreground">{f.help}</p>
        ) : null}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!saving ? onOpenChange(v) : null)}>
      <DialogContent className={`${size} max-h-[92vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="text-[17px]">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-[12.5px]">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {Object.entries(grouped).map(([section, sectionFields]) => (
            <div key={section} className="space-y-3">
              {section !== '__main' ? (
                <p className="htt-label border-b border-border/60 pb-1.5">{section}</p>
              ) : null}
              <div className={`grid grid-cols-1 gap-3 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
                {sectionFields.map(renderField)}
              </div>
            </div>
          ))}
          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="bg-[#0B1F3A] hover:bg-[#132E52]">
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
