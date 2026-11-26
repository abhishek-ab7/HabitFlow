type FilterFn = (row: any) => boolean;

interface QueryState {
  tableName: string;
  filters: FilterFn[];
  pendingAction: 'select' | 'insert' | 'update' | 'delete';
  payloadData: any;
  isSingle: boolean;
  countExact: boolean;
  headOnly: boolean;
  orderCols: Array<{ col: string; asc: boolean }>;
  rangeBounds: [number, number] | null;
  maxRows: number | null;
}

function executeInsert(tableStore: Map<string, any[]>, state: QueryState, rows: any[]) {
  const toInsert = Array.isArray(state.payloadData) ? state.payloadData : [state.payloadData];
  const inserted = toInsert.map((item) => ({ id: item.id || crypto.randomUUID(), ...item }));
  tableStore.set(state.tableName, [...rows, ...inserted]);
  return { data: state.isSingle ? inserted[0] : inserted, error: null };
}

function mutateFilteredRows(
  tableStore: Map<string, any[]>,
  state: QueryState,
  rows: any[],
  mode: 'update' | 'delete'
) {
  const affected: any[] = [];
  const nextRows: any[] = [];
  for (const r of rows) {
    if (!state.filters.every((fn) => fn(r))) {
      nextRows.push(r);
      continue;
    }
    if (mode === 'update') {
      const updated = { ...r, ...state.payloadData };
      affected.push(updated);
      nextRows.push(updated);
    } else {
      affected.push(r);
    }
  }
  tableStore.set(state.tableName, nextRows);
  return { data: state.isSingle ? affected[0] ?? null : affected, error: null };
}

function compareRows(a: any, b: any, orderCols: Array<{ col: string; asc: boolean }>): number {
  for (const { col, asc } of orderCols) {
    const av = a[col] ?? '';
    const bv = b[col] ?? '';
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
    if (cmp !== 0) return asc ? cmp : -cmp;
  }
  return 0;
}

function executeSelect(state: QueryState, matching: any[]) {
  let result = [...matching];
  if (state.orderCols.length > 0) {
    result.sort((a, b) => compareRows(a, b, state.orderCols));
  }
  const totalCount = result.length;
  if (state.rangeBounds) {
    result = result.slice(state.rangeBounds[0], state.rangeBounds[1] + 1);
  } else if (state.maxRows !== null) {
    result = result.slice(0, state.maxRows);
  }

  if (state.headOnly) {
    return { data: null, count: state.countExact ? totalCount : null, error: null };
  }
  const data = state.isSingle ? result[0] ?? null : result;
  return { data, count: state.countExact ? totalCount : undefined, error: null };
}

async function execQuery(tableStore: Map<string, any[]>, state: QueryState) {
  const rows = tableStore.get(state.tableName) || [];
  if (state.pendingAction === 'insert') return executeInsert(tableStore, state, rows);
  if (state.pendingAction === 'update') return mutateFilteredRows(tableStore, state, rows, 'update');
  if (state.pendingAction === 'delete') return mutateFilteredRows(tableStore, state, rows, 'delete');
  const matching = rows.filter((r) => state.filters.every((fn) => fn(r)));
  return executeSelect(state, matching);
}

export function makeMcpSupabaseFake(tableStore: Map<string, any[]>) {
  const createBuilder = (tableName: string) => {
    const state: QueryState = {
      tableName,
      filters: [],
      pendingAction: 'select',
      payloadData: null,
      isSingle: false,
      countExact: false,
      headOnly: false,
      orderCols: [],
      rangeBounds: null,
      maxRows: null,
    };

    const builder: any = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.count === 'exact') state.countExact = true;
        if (opts?.head) state.headOnly = true;
        return builder;
      },
      insert: (data: any) => { state.pendingAction = 'insert'; state.payloadData = data; return builder; },
      update: (data: any) => { state.pendingAction = 'update'; state.payloadData = data; return builder; },
      delete: () => { state.pendingAction = 'delete'; return builder; },
      eq: (col: string, val: any) => { state.filters.push((r) => r[col] === val); return builder; },
      neq: (col: string, val: any) => { state.filters.push((r) => r[col] !== val); return builder; },
      in: (col: string, vals: any[]) => { state.filters.push((r) => vals.includes(r[col])); return builder; },
      ilike: (col: string, pattern: string) => {
        const needle = pattern.replace(/%/g, '').toLowerCase();
        state.filters.push((r) => String(r[col] ?? '').toLowerCase().includes(needle));
        return builder;
      },
      gte: (col: string, val: any) => { state.filters.push((r) => String(r[col] ?? '') >= String(val)); return builder; },
      lte: (col: string, val: any) => { state.filters.push((r) => String(r[col] ?? '') <= String(val)); return builder; },
      is: (col: string, val: any) => { state.filters.push((r) => (r[col] ?? null) === val); return builder; },
      or: () => builder,
      order: (col: string, opts?: { ascending?: boolean }) => {
        state.orderCols.push({ col, asc: opts?.ascending !== false });
        return builder;
      },
      range: (from: number, to: number) => { state.rangeBounds = [from, to]; return builder; },
      limit: (n: number) => { state.maxRows = n; return builder; },
      maybeSingle: () => { state.isSingle = true; return execQuery(tableStore, state); },
      single: () => { state.isSingle = true; return execQuery(tableStore, state); },
      then: (resolve: (val: any) => void, reject?: (err: any) => void) =>
        execQuery(tableStore, state).then(resolve, reject),
    };

    return builder;
  };

  return { from: (tableName: string) => createBuilder(tableName) };
}
