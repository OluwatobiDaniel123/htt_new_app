import { base44 } from '@/api/base44Client';

export const safeCount = async (entityName, query = {}) => {
  try {
    const c = await base44.entities[entityName].count(query);
    return typeof c === 'number' ? c : 0;
  } catch {
    return 0;
  }
};

export const safeList = async (entityName, query = {}, options = {}) => {
  try {
    if (entityName === 'User') {
      const res = await base44.entities.User.list();
      const arr = Array.isArray(res) ? res : res?.items || [];
      return arr;
    }
    const res = await base44.entities[entityName].filter(query, options);
    return res?.items || [];
  } catch {
    return [];
  }
};

export const safeAggregate = async (entityName, params) => {
  try {
    const res = await base44.entities[entityName].aggregate(params);
    return res?.rows || [];
  } catch {
    return [];
  }
};

export const sumOf = (rows, key) =>
  rows.reduce((acc, row) => acc + Number(row?.[key] || 0), 0);

export const bucketByMonth = (items, dateField = 'created_date', months = 6) => {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-NG', { month: 'short' }),
      count: 0,
    });
  }
  const index = buckets.reduce((acc, b) => ({ ...acc, [b.key]: b }), {});
  items.forEach((item) => {
    const raw = item?.[dateField];
    if (!raw) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (index[key]) index[key].count += 1;
  });
  return buckets;
};
