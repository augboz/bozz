// The assistant's whole vocabulary: a closed list of typed operations.
//
// The model never touches the store. It proposes ops; the app validates them
// here (zod), simulates them (applyOps.ts), shows the user, then commits.
// Anything not in this file cannot happen. Sync, accounts, connectors and
// billing are deliberately absent.
//
// Every optional field is `nullable` rather than `optional`, so the JSON
// schema handed to the model has every key required with an explicit null.
// That keeps the three providers' strict/function-calling modes happy.
import { z } from 'zod';
import type { WidgetType } from '../types';
import { WIDGET_CATALOG } from '../widgetCatalog';

const widgetTypes = Object.keys(WIDGET_CATALOG) as [WidgetType, ...WidgetType[]];

/** A CSS colour: #hex, rgb()/hsl(), or a plain named colour. Nothing that can smuggle a url. */
export const cssColor = z.string().trim().max(40).regex(
  /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/]+\)|[a-z]{3,20})$/i,
  'not a CSS colour',
);

/** Per-widget config the assistant may set. Unknown keys are dropped at apply time. */
export const widgetConfigSchema = z.object({
  widgetColor: cssColor.nullable(),
  bgColor: cssColor.nullable(),
  textColor: cssColor.nullable(),
  /** topicNote: plain text. */
  note: z.string().max(20_000).nullable(),
  /** topicLinks: {label,url}[] */
  links: z.array(z.object({ label: z.string().max(80), url: z.string().url().max(2000) })).max(30).nullable(),
  /** today */
  showEvents: z.boolean().nullable(),
  showTasks: z.boolean().nullable(),
  /** photo */
  caption: z.string().max(200).nullable(),
}).partial();
export type WidgetConfigInput = z.infer<typeof widgetConfigSchema>;

const size = z.object({ w: z.number().int().min(1).max(24), h: z.number().int().min(1).max(60) });
const placement = z.enum(['top', 'bottom']);
const pageRef = z.string().min(1).max(64).describe("'home' or a page id from the snapshot");

const widgetSpec = z.object({
  type: z.enum(widgetTypes),
  size: size.nullable(),
  config: widgetConfigSchema.nullable(),
});

export const opSchemas = {
  add_widget: z.object({
    op: z.literal('add_widget'),
    page: pageRef,
    type: z.enum(widgetTypes),
    size: size.nullable().describe('null = the type\'s default size'),
    placement: placement.nullable().describe('null = bottom'),
    config: widgetConfigSchema.nullable(),
  }),
  configure_widget: z.object({
    op: z.literal('configure_widget'),
    widgetId: z.string().min(1),
    config: widgetConfigSchema,
  }),
  move_widget: z.object({
    op: z.literal('move_widget'),
    widgetId: z.string().min(1),
    size: size.nullable(),
    placement: placement.nullable(),
  }),
  remove_widget: z.object({
    op: z.literal('remove_widget'),
    widgetId: z.string().min(1),
  }),
  create_page: z.object({
    op: z.literal('create_page'),
    name: z.string().trim().min(1).max(60),
    folderId: z.string().nullable(),
    icon: z.string().max(40).nullable().describe('a Lucide icon name, e.g. book, code, flask-conical'),
    color: cssColor.nullable(),
    stages: z.array(z.string().trim().min(1).max(30)).min(1).max(8).nullable().describe('task columns; the last one is Done'),
    widgets: z.array(widgetSpec).max(12).nullable().describe('the page always gets a task list; list extra widgets here'),
    description: z.string().max(400).nullable(),
    pageTitle: z.string().max(80).nullable(),
    pageTitleSize: z.enum(['s', 'm', 'l', 'xl']).nullable(),
    pageTitleColor: cssColor.nullable(),
  }),
  update_page: z.object({
    op: z.literal('update_page'),
    topicId: z.string().min(1),
    name: z.string().trim().min(1).max(60).nullable(),
    folderId: z.string().nullable().describe("a folder id, or 'none' to unfile"),
    icon: z.string().max(40).nullable(),
    color: cssColor.nullable(),
    description: z.string().max(400).nullable(),
    pageTitle: z.string().max(80).nullable().describe("'' clears it back to the sidebar name"),
    pageTitleSize: z.enum(['s', 'm', 'l', 'xl']).nullable(),
    pageTitleColor: cssColor.nullable(),
    status: z.enum(['onTrack', 'needsWork', 'none']).nullable(),
  }),
  delete_page: z.object({
    op: z.literal('delete_page'),
    topicId: z.string().min(1),
  }),
  create_folder: z.object({
    op: z.literal('create_folder'),
    name: z.string().trim().min(1).max(60),
    color: cssColor.nullable(),
    icon: z.string().max(40).nullable(),
  }),
  set_appearance: z.object({
    op: z.literal('set_appearance'),
    mood: z.enum(['dark', 'light', 'warm']).nullable(),
    font: z.enum(['geist', 'inter', 'manrope', 'quicksand', 'mono', 'fraunces']).nullable(),
    fontSize: z.enum(['small', 'medium', 'large', 'xlarge']).nullable(),
    widgetShape: z.enum(['sharp', 'rounded', 'pill']).nullable(),
    widgetBorder: z.enum(['subtle', 'normal', 'bold']).nullable(),
  }),
  set_readability: z.object({
    op: z.literal('set_readability'),
    lineHeight: z.number().min(1.1).max(2.2).nullable().describe('1.5 is the accessibility baseline'),
    letterSpacing: z.number().min(0).max(0.2).nullable().describe('em; 0.12 is the accessibility baseline'),
    wordSpacing: z.number().min(0).max(0.4).nullable().describe('em; 0.16 is the accessibility baseline'),
    reducedMotion: z.boolean().nullable(),
    reset: z.boolean().nullable().describe('true = back to defaults'),
  }),
  apply_world: z.object({
    op: z.literal('apply_world'),
    worldId: z.string().min(1),
    scope: z.enum(['global', 'newPage', 'existingPage']),
    topicId: z.string().nullable().describe('for existingPage'),
    name: z.string().max(60).nullable().describe('for newPage'),
  }),
  edit_note: z.object({
    op: z.literal('edit_note'),
    target: z.enum(['page', 'widget']),
    id: z.string().min(1).describe('page id, or a Note widget id'),
    mode: z.enum(['replace', 'append']),
    text: z.string().max(20_000),
  }),
  add_task: z.object({
    op: z.literal('add_task'),
    topicId: z.string().min(1),
    text: z.string().trim().min(1).max(300),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe('YYYY-MM-DD'),
    stageId: z.string().nullable(),
  }),
  complete_task: z.object({
    op: z.literal('complete_task'),
    topicId: z.string().min(1),
    itemId: z.number().int(),
  }),
  add_habit: z.object({
    op: z.literal('add_habit'),
    name: z.string().trim().min(1).max(80),
    topicId: z.string().nullable().describe('null = general habit'),
    frequency: z.enum(['daily', 'weekly']),
    days: z.array(z.number().int().min(0).max(6)).max(7).nullable().describe('daily only: 0=Mon..6=Sun; null = every day'),
    color: cssColor.nullable(),
  }),
} as const;

export const opSchema = z.discriminatedUnion('op', [
  opSchemas.add_widget, opSchemas.configure_widget, opSchemas.move_widget, opSchemas.remove_widget,
  opSchemas.create_page, opSchemas.update_page, opSchemas.delete_page, opSchemas.create_folder,
  opSchemas.set_appearance, opSchemas.set_readability, opSchemas.apply_world,
  opSchemas.edit_note, opSchemas.add_task, opSchemas.complete_task, opSchemas.add_habit,
]);
export type Op = z.infer<typeof opSchema>;
export type OpName = Op['op'];

export const MAX_OPS_PER_TURN = 25;

export const applyChangesSchema = z.object({
  summary: z.string().max(300).describe('one plain sentence for the user, present tense'),
  ops: z.array(opSchema).min(1).max(MAX_OPS_PER_TURN),
});
export type ApplyChangesInput = z.infer<typeof applyChangesSchema>;

export const readDashboardSchema = z.object({
  scope: z.string().min(1).describe("'summary' or a page id"),
});

/** Ops that destroy something and always need the user's confirmation. */
export const DESTRUCTIVE_OPS: ReadonlySet<OpName> = new Set(['remove_widget', 'delete_page']);

export interface OpIssue { index: number; message: string }

/** Validate a raw tool input. Returns typed ops or per-op messages for the model. */
export function parseOps(raw: unknown): { ok: true; value: ApplyChangesInput } | { ok: false; issues: OpIssue[]; message: string } {
  const r = applyChangesSchema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  const issues: OpIssue[] = r.error.issues.map(i => ({
    index: typeof i.path[1] === 'number' ? i.path[1] : -1,
    message: `${i.path.join('.')}: ${i.message}`,
  }));
  return { ok: false, issues, message: issues.map(i => i.message).join('; ') };
}
