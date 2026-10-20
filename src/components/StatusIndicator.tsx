import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import type { TaskPriority, TaskStatus } from '../shared/constants.ts';

export function StatusText({ status }: { status: TaskStatus }) {
  if (status === 'Completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Completed</span>
      </span>
    );
  }
  if (status === 'In Progress') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>In Progress</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
      <Circle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Not Started</span>
    </span>
  );
}


export function PriorityText({ priority }: { priority: TaskPriority }) {
  if (priority === 'Urgent') {
    return (
      <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 whitespace-nowrap">
        Urgent
      </span>
    );
  }
  if (priority === 'High') {
    return (
      <span className="text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
        High
      </span>
    );
  }
  if (priority === 'Low') {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Low</span>
    );
  }
  return (
    <span className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">Normal</span>
  );
}
