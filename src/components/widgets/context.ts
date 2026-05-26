import type React from 'react';
import type {
  Application, BudgetData, EmailMessage, ListItem, SectionId,
  TaskListKey, Theme,
} from '../../lib/types';

/** Everything a home widget might need. Passed uniformly to every widget. */
export interface WidgetCtx {
  t: Theme;
  musicItems: ListItem[];
  lifeItems: ListItem[];
  cvItems: ListItem[];
  otherItems: ListItem[];
  applications: Application[];
  budget: BudgetData;
  emails: EmailMessage[];
  /** No-op while the home grid is in edit mode (prevents accidental nav). */
  setActiveSection: (id: SectionId) => void;
  /** Push a new task into one of the four lists. */
  addTask: (list: TaskListKey, text: string, deadline: number | null) => void;
}

export type WidgetComponent = React.FC<{ ctx: WidgetCtx }>;
