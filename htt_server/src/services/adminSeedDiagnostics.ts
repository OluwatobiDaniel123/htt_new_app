interface ErrorRecord {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  code?: unknown;
  sql?: unknown;
  table?: unknown;
  cause?: unknown;
  parent?: unknown;
  original?: unknown;
}

const asRecord = (value: unknown): ErrorRecord | undefined =>
  typeof value === "object" && value !== null
    ? (value as ErrorRecord)
    : undefined;

const redact = (value: string, secrets: string[]) => {
  let safe = value
    .replace(/(postgres(?:ql)?:\/\/)[^/@\s]+@/gi, "$1[REDACTED]@")
    .replace(/(password|secret|token|api[_-]?key)(\s*[:=]\s*)([^\s,;]+)/gi, "$1$2[REDACTED]")
    .replace(/(password authentication failed for user\s+)["'][^"']+["']/gi, "$1[REDACTED]")
    .replace(/(role\s+)["'][^"']+["'](\s+does not exist)/gi, "$1[REDACTED]$2");
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length))
    safe = safe.split(secret).join("[REDACTED]");
  return safe;
};

const safeSql = (sql: string, secrets: string[]) =>
  redact(sql.replace(/'(?:''|[^'])*'/g, "'[REDACTED]'"), secrets);

export function adminSeedErrorDetails(error: unknown, secrets: string[]) {
  const entries: Array<{ name: string; message: string; stack?: string }> = [];
  const visited = new Set<object>();
  let current: unknown = error;

  while (current !== undefined && current !== null) {
    const record = asRecord(current);
    if (!record || visited.has(current as object)) break;
    visited.add(current as object);
    entries.push({
      name: typeof record.name === "string" ? redact(record.name, secrets) : "Error",
      message: typeof record.message === "string" ? redact(record.message, secrets) : redact(String(current), secrets),
      ...(typeof record.stack === "string" ? { stack: redact(record.stack, secrets) } : {}),
    });
    current = record.cause ?? record.original ?? record.parent;
  }

  const records = [error, ...entries.map((_entry, index) => {
    let item: unknown = error;
    for (let step = 0; step <= index; step += 1) {
      const record = asRecord(item);
      item = record?.cause ?? record?.original ?? record?.parent;
    }
    return item;
  })].map(asRecord).filter((record): record is ErrorRecord => Boolean(record));
  const codedError = records.find((record) => typeof record.code === "string");
  const postgresError = records.find(
    (record) =>
      typeof record.code === "string" && /^[0-9A-Z]{5}$/.test(record.code),
  );
  const sqlError = records.find((record) => typeof record.sql === "string");
  const tableError = records.find((record) => typeof record.table === "string");

  return {
    errors: entries,
    postgresCode: typeof postgresError?.code === "string" ? postgresError.code : null,
    systemCode: typeof codedError?.code === "string" && codedError !== postgresError ? codedError.code : null,
    sql: typeof sqlError?.sql === "string" ? safeSql(sqlError.sql, secrets) : null,
    table: typeof tableError?.table === "string" ? redact(tableError.table, secrets) : null,
  };
}
