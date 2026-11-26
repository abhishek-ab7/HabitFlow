import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import { authorizeMcpTool, logAndReturnMcpError, logAndReturnMcpSuccess, mcpError } from '../tool-helpers';
import { listSupplementLogs, logSupplementDose, mutateSupplementLog } from './supplement-log-ops';
import {
  deleteOrRestoreSupplementItem,
  readInventoryAndRoi,
  restockSupplementItem,
  upsertSupplementItem,
} from './supplement-inventory-ops';

type IsoDate = string;

const SUPPLEMENT_WRITE_HANDLERS: Record<
  string,
  (
    supabase: ReturnType<typeof getSupabaseAdmin>,
    auth: McpAuthContext,
    todayIst: IsoDate,
    args: Record<string, unknown>
  ) => Promise<{ error?: string; payload?: unknown }>
> = {
  delete_item: (supabase, auth, _today, args) => deleteOrRestoreSupplementItem(supabase, auth.userId, args),
  restore_item: (supabase, auth, _today, args) => deleteOrRestoreSupplementItem(supabase, auth.userId, args),
  restock_item: (supabase, auth, todayIst, args) => restockSupplementItem(supabase, auth, todayIst, args),
  update_log: (supabase, auth, _today, args) => mutateSupplementLog(supabase, auth.userId, args),
  delete_log: (supabase, auth, _today, args) => mutateSupplementLog(supabase, auth.userId, args),
  restore_log: (supabase, auth, _today, args) => mutateSupplementLog(supabase, auth.userId, args),
  log_dose: (supabase, auth, todayIst, args) => logSupplementDose(supabase, auth.userId, todayIst, args),
  upsert_item: (supabase, auth, todayIst, args) => upsertSupplementItem(supabase, auth.userId, todayIst, args),
};

async function handleManageSupplementsWrite(auth: McpAuthContext, todayIst: IsoDate, args: Record<string, unknown>) {
  const startMs = Date.now();
  const handler = SUPPLEMENT_WRITE_HANDLERS[String(args.action)] ?? SUPPLEMENT_WRITE_HANDLERS.upsert_item;

  try {
    const outcome = await handler(getSupabaseAdmin(), auth, todayIst, args);
    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_supplements',
      action: String(args.action),
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_supplements',
      action: String(args.action),
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage supplements',
    });
  }
}

const SUPPLEMENT_READ_ACTIONS = new Set(['list_logs', 'list_inventory', 'get_roi_audit']);

async function handleSupplementToolCall(args: Record<string, unknown>) {
  const todayIst = getIstIsoDate();
  const action = String(args.action);
  if (SUPPLEMENT_READ_ACTIONS.has(action)) {
    const authRes = authorizeMcpTool('habitflow:read');
    if (!authRes.ok) return authRes.response;
    return action === 'list_logs'
      ? listSupplementLogs(authRes.auth.userId, args)
      : readInventoryAndRoi(authRes.auth, todayIst, args);
  }
  const authRes = authorizeMcpTool('habitflow:write');
  if (!authRes.ok) return authRes.response;
  return handleManageSupplementsWrite(authRes.auth, todayIst, args);
}

export function registerManageSupplementsTool(server: McpServer) {
  server.registerTool(
    'manage_supplements',
    {
      title: 'Manage Supplements, Dose Logs & ROI Audit',
      description:
        'Full CRUD for supplement inventory and dose logs: list_inventory, upsert_item, restock_item (optionally creating a linked finance expense), delete_item, restore_item, log_dose, list_logs, update_log, delete_log, restore_log, and get_roi_audit.',
      inputSchema: {
        action: z
          .enum([
            'list_inventory',
            'upsert_item',
            'restock_item',
            'delete_item',
            'restore_item',
            'log_dose',
            'list_logs',
            'update_log',
            'delete_log',
            'restore_log',
            'get_roi_audit',
          ])
          .describe('Supplement action'),
        supplementId: z.string().uuid().optional(),
        logId: z.string().uuid().optional().describe('Supplement dose log UUID for update_log, delete_log, restore_log'),
        name: z.string().min(1).max(120).optional(),
        brand: z.string().nullable().optional(),
        category: z.enum(['protein', 'creatine', 'vitamin', 'mineral', 'omega', 'pre_workout', 'other']).optional(),
        unitLabel: z.string().optional(),
        totalServings: z.number().min(1).optional(),
        addedServings: z.number().min(1).optional().describe('Additional servings when restocking'),
        remainingServings: z.number().min(0).optional(),
        dailyDosage: z.number().min(0.1).optional(),
        costInr: z.number().min(0).optional(),
        proteinPerServingG: z.number().min(0).nullable().optional(),
        anchorBlock: z.enum(['morning', 'work', 'gym', 'night']).nullable().optional(),
        lowStockThresholdDays: z.number().int().min(1).max(60).optional(),
        isActive: z.boolean().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        includeDeleted: z.boolean().optional().default(false),
        servingsTaken: z.number().min(0.1).optional(),
        expenseAmount: z.number().positive().optional().describe('Optional INR amount spent when restocking to auto-create linked finance expense'),
        accountId: z.string().uuid().optional().describe('Source finance account UUID for compound restock expense'),
        expenseCategoryId: z.string().uuid().optional(),
        notes: z.string().nullable().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for delete_item and delete_log'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    handleSupplementToolCall
  );
}
