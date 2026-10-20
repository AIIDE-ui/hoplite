import { z } from 'zod';
import {
  COURSE_STATUSES,
  DATE_FORMATS,
  TASK_DIFFICULTIES,
  TASK_LEVELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  THEME_MODES,
  TIME_FORMATS,
  WEEK_STARTS,
} from '../../src/shared/constants.ts';
import { AppError } from '../errors.ts';

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

const nullableDateString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === undefined || val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || ymdRegex.test(val), {
    message: 'Date must be in YYYY-MM-DD format.',
  });

export const profileUpdateSchema = z.object({
  name: z.string().max(120, 'Name must be 120 characters or fewer.').default(''),
  roll_number: z.string().max(60, 'Roll number must be 60 characters or fewer.').default(''),
  university: z
    .string()
    .trim()
    .min(1, 'University is required.')
    .max(150, 'University must be 150 characters or fewer.')
    .default('TNTEU'),
  programme: z
    .string()
    .trim()
    .min(1, 'Programme is required.')
    .max(60, 'Programme must be 60 characters or fewer.')
    .default('B.Ed.'),
  semester: z.coerce.number().int().min(1).max(8).default(3),
  syllabus_pattern: z
    .string()
    .trim()
    .min(1, 'Syllabus pattern is required.')
    .max(100, 'Syllabus pattern must be 100 characters or fewer.'),
  academic_year: z.string().max(40, 'Academic year must be 40 characters or fewer.').default(''),
  college: z.string().max(200, 'College name must be 200 characters or fewer.').default(''),
  teaching_subject: z
    .string()
    .max(120, 'Teaching subject must be 120 characters or fewer.')
    .default(''),
});

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required.')
    .max(120, 'Category name must be 120 characters or fewer.'),
  description: z.string().max(500, 'Description must be 500 characters or fewer.').default(''),
  note: z.string().max(1000, 'Note must be 1,000 characters or fewer.').default(''),
});

export const categoryUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required.')
    .max(120, 'Category name must be 120 characters or fewer.')
    .optional(),
  description: z.string().max(500, 'Description must be 500 characters or fewer.').optional(),
  note: z.string().max(1000, 'Note must be 1,000 characters or fewer.').optional(),
  sort_order: z.coerce.number().int().optional(),
});

const taskBaseObject = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required (1–200 characters).')
    .max(200, 'Title must be 200 characters or fewer.'),
  category_id: z.coerce.number().int().positive('Please select a valid category.'),
  level: z.enum(TASK_LEVELS).default('N/A'),
  status: z.enum(TASK_STATUSES).default('Not Started'),
  difficulty: z.enum(TASK_DIFFICULTIES).default('Medium'),
  priority: z.enum(TASK_PRIORITIES).default('Normal'),
  start_date: nullableDateString.default(null),
  due_date: nullableDateString.default(null),
  notes: z.string().max(10000, 'Notes must be 10,000 characters or fewer.').default(''),
  estimated_minutes: z.coerce
    .number()
    .int('Estimated effort must be a whole number of minutes.')
    .min(0, 'Estimated effort cannot be negative.')
    .default(0),
  credits: z.coerce.number().min(0, 'Credits must be 0 or greater.').default(0),
  marks: z.coerce.number().min(0, 'Marks must be 0 or greater.').default(0),
  manual_minutes_adjustment: z.coerce
    .number()
    .int('Manual minutes adjustment must be an integer.')
    .default(0),
});

const optionalNullableDateString = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || ymdRegex.test(val), {
    message: 'Date must be in YYYY-MM-DD format.',
  })
  .optional();

export const taskCreateSchema = taskBaseObject.superRefine((data, ctx) => {
  if (data.start_date && data.due_date && data.start_date > data.due_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['due_date'],
      message: 'Due date must be on or after the start date.',
    });
  }
});

export const taskUpdateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required (1–200 characters).')
      .max(200, 'Title must be 200 characters or fewer.')
      .optional(),
    category_id: z.coerce.number().int().positive('Please select a valid category.').optional(),
    level: z.enum(TASK_LEVELS).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    difficulty: z.enum(TASK_DIFFICULTIES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    start_date: optionalNullableDateString,
    due_date: optionalNullableDateString,
    notes: z.string().max(10000, 'Notes must be 10,000 characters or fewer.').optional(),
    estimated_minutes: z.coerce
      .number()
      .int('Estimated effort must be a whole number of minutes.')
      .min(0, 'Estimated effort cannot be negative.')
      .optional(),
    credits: z.coerce.number().min(0, 'Credits must be 0 or greater.').optional(),
    marks: z.coerce.number().min(0, 'Marks must be 0 or greater.').optional(),
    manual_minutes_adjustment: z.coerce
      .number()
      .int('Manual minutes adjustment must be an integer.')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.start_date !== undefined &&
      data.due_date !== undefined &&
      data.start_date !== null &&
      data.due_date !== null &&
      data.start_date > data.due_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['due_date'],
        message: 'Due date must be on or after the start date.',
      });
    }
  });

export const taskReorderSchema = z
  .object({
    taskIds: z.array(z.coerce.number().int().positive()).optional(),
    taskId: z.coerce.number().int().positive().optional(),
    direction: z.enum(['up', 'down']).optional(),
  })
  .refine(
    (d) =>
      (Array.isArray(d.taskIds) && d.taskIds.length > 0) ||
      (d.taskId !== undefined && d.direction !== undefined),
    {
      message: 'Provide either taskIds array or taskId + direction.',
    }
  );

export const taskBulkSchema = z.object({
  taskIds: z
    .array(z.coerce.number().int().positive())
    .min(1, 'Select at least one task for bulk action.'),
  action: z.enum(['status', 'archive', 'restore']),
  status: z.enum(TASK_STATUSES).optional(),
});

export const restoreSyllabusSchema = z.object({
  confirm: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
});

export const subtaskCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Subtask title is required.')
    .max(200, 'Subtask title must be 200 characters or fewer.'),
  done: z.boolean().optional().default(false),
});

export const subtaskUpdateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Subtask title is required.')
    .max(200, 'Subtask title must be 200 characters or fewer.')
    .optional(),
  done: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});

export const noteCreateSchema = z.object({
  task_id: z
    .union([z.coerce.number().int().positive(), z.null(), z.undefined()])
    .transform((v) => (v === undefined ? null : v))
    .default(null),
  title: z.string().trim().max(200, 'Note title must be 200 characters or fewer.').default(''),
  content: z
    .string()
    .trim()
    .min(1, 'Note content is required.')
    .max(10000, 'Note content must be 10,000 characters or fewer.'),
});

export const noteUpdateSchema = z.object({
  task_id: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  title: z.string().trim().max(200, 'Note title must be 200 characters or fewer.').optional(),
  content: z
    .string()
    .trim()
    .min(1, 'Note content is required.')
    .max(10000, 'Note content must be 10,000 characters or fewer.')
    .optional(),
});

export const focusSessionCreateSchema = z.object({
  task_id: z
    .union([z.coerce.number().int().positive(), z.null(), z.undefined()])
    .transform((v) => (v === undefined ? null : v))
    .default(null),
  duration_minutes: z.coerce
    .number()
    .int()
    .min(1, 'Focus session must be at least 1 minute.')
    .max(1440, 'Focus session cannot exceed 24 hours.'),
  started_at: z.string().optional(),
  ended_at: z.string().nullable().optional(),
  notes: z.string().max(1000, 'Session notes must be 1,000 characters or fewer.').default(''),
});

export const syllabusUpdateSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  official_credits: z.coerce.number().min(0, 'Credits must be 0 or greater.').optional(),
  official_marks: z.coerce.number().min(0, 'Marks must be 0 or greater.').optional(),
  note: z.string().max(1000, 'Note must be 1,000 characters or fewer.').optional(),
  course_status: z.enum(COURSE_STATUSES).nullable().optional(),
  confirm: z.boolean().optional().default(false),
});

export const settingsUpdateSchema = z.object({
  theme: z.enum(THEME_MODES).optional(),
  week_start: z.enum(WEEK_STARTS).optional(),
  date_format: z.enum(DATE_FORMATS).optional(),
  time_format: z.enum(TIME_FORMATS).optional(),
});

export const authRegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(40, 'Username must be 40 characters or fewer.')
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Username may only contain letters, numbers, underscores, dots, and hyphens.'
    ),
  display_name: z
    .string()
    .trim()
    .min(1, 'Full name is required.')
    .max(120, 'Full name must be 120 characters or fewer.'),
  roll_number: z.string().trim().max(60, 'Roll number must be 60 characters or fewer.').default(''),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password must be 128 characters or fewer.'),
});

export const authLoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, 'Admin username is required.'),
  password: z.string().min(1, 'Admin password is required.'),
});

export const adminCredentialsUpdateSchema = z.object({
  current_password: z.string().min(1, 'Current admin password is required.'),
  new_username: z
    .string()
    .trim()
    .min(3, 'Admin username must be at least 3 characters.')
    .max(40, 'Admin username must be 40 characters or fewer.')
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Username may only contain letters, numbers, underscores, dots, and hyphens.'
    )
    .optional(),
  new_password: z
    .string()
    .min(6, 'New password must be at least 6 characters.')
    .max(128, 'New password must be 128 characters or fewer.'),
});

export const adminUserUpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(40, 'Username must be 40 characters or fewer.')
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Username may only contain letters, numbers, underscores, dots, and hyphens.'
    )
    .optional(),
  display_name: z
    .string()
    .trim()
    .min(1, 'Full name is required.')
    .max(120, 'Full name must be 120 characters or fewer.')
    .optional(),
  roll_number: z
    .string()
    .trim()
    .max(60, 'Roll number must be 60 characters or fewer.')
    .optional(),
  college: z
    .string()
    .trim()
    .max(160, 'College name must be 160 characters or fewer.')
    .optional(),
  new_password: z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password must be 128 characters or fewer.')
    .optional(),
});

export const backupImportSchema = z.object({
  confirm: z.boolean().refine((v) => v === true, {
    message: 'Confirmation (confirm: true) is required to import a backup.',
  }),
  backup: z.object({
    profile: z.record(z.string(), z.unknown()).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    categories: z.array(z.record(z.string(), z.unknown())).optional(),
    tasks: z.array(z.record(z.string(), z.unknown())),
    subtasks: z.array(z.record(z.string(), z.unknown())).optional(),
    task_notes: z.array(z.record(z.string(), z.unknown())).optional(),
    focus_sessions: z.array(z.record(z.string(), z.unknown())).optional(),
    task_activity: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
});

export function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    let firstMessage = 'Invalid request data.';
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? issue.path.join('.') : 'root';
      if (!fields[key]) {
        fields[key] = issue.message;
      }
      if (firstMessage === 'Invalid request data.') {
        firstMessage = issue.message;
      }
    }
    throw new AppError(422, 'VALIDATION_ERROR', firstMessage, fields);
  }
  return result.data;
}

