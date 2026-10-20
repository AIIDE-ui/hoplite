import type {
  CourseStatus,
  SyllabusPart,
  TaskDifficulty,
  TaskLevel,
  TaskPriority,
  TaskStatus,
} from '../../src/shared/constants.ts';
import { SWAYAM_INFO_TEXT, TEACHING_COMPETENCY_NOTE } from '../../src/shared/constants.ts';

export interface SeedCategoryDef {
  seed_key: string;
  name: string;
  description: string;
  note: string;
  sort_order: number;
}

export interface SeedTaskDef {
  seed_key: string;
  category_seed_key: 'part_a' | 'part_b';
  title: string;
  level: TaskLevel;
  status: TaskStatus;
  difficulty: TaskDifficulty;
  priority: TaskPriority;
  credits: number;
  marks: number;
  sort_order: number;
}

export interface SeedSyllabusSummaryDef {
  part: SyllabusPart;
  title: string;
  official_credits: number;
  official_marks: number;
  note: string;
  course_status: CourseStatus | null;
}

export const SEED_CATEGORIES: SeedCategoryDef[] = [
  {
    seed_key: 'part_a',
    name: 'Part A — Teaching Competency and Practical Records',
    description:
      'School internship teaching competency and practical records for Semester III (Level I, Level II, and general records).',
    note: TEACHING_COMPETENCY_NOTE,
    sort_order: 1,
  },
  {
    seed_key: 'part_b',
    name: 'Part B — EPC Records',
    description: 'Enhancing Professional Capacities (EPC) practical records for Semester III.',
    note: 'Includes four mandatory EPC records (1 credit / 20 marks each).',
    sort_order: 2,
  },
  {
    seed_key: 'part_c',
    name: 'Part C — Online Course (SWAYAM)',
    description: SWAYAM_INFO_TEXT,
    note: 'Complete one approved SWAYAM online course during Semester III. Course status does not affect practical record completion percentage.',
    sort_order: 3,
  },
];

export const SEED_SYLLABUS_SUMMARY: SeedSyllabusSummaryDef[] = [
  {
    part: 'Part A',
    title: 'Part A — Teaching Competency and Practical Records',
    official_credits: 20,
    official_marks: 400,
    note: TEACHING_COMPETENCY_NOTE,
    course_status: null,
  },
  {
    part: 'Part B',
    title: 'Part B — EPC Records',
    official_credits: 4,
    official_marks: 80,
    note: 'Enhancing Professional Capacities (EPC) practical records.',
    course_status: null,
  },
  {
    part: 'Part C',
    title: 'Part C — Online Course (SWAYAM)',
    official_credits: 1,
    official_marks: 20,
    note: SWAYAM_INFO_TEXT,
    course_status: 'Not Started',
  },
];

export const SEED_TASKS: SeedTaskDef[] = [
  // Part A (16 tasks)
  {
    seed_key: 'part_a_01_observation_l1',
    category_seed_key: 'part_a',
    title: 'Observation Record — Level I',
    level: 'Level I',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 1,
  },
  {
    seed_key: 'part_a_02_observation_l2',
    category_seed_key: 'part_a',
    title: 'Observation Record — Level II',
    level: 'Level II',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 2,
  },
  {
    seed_key: 'part_a_03_micro_teaching_l1',
    category_seed_key: 'part_a',
    title: 'Micro Teaching Record — Level I',
    level: 'Level I',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 3,
  },
  {
    seed_key: 'part_a_04_micro_teaching_l2',
    category_seed_key: 'part_a',
    title: 'Micro Teaching Record — Level II',
    level: 'Level II',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 4,
  },
  {
    seed_key: 'part_a_05_demonstration_l1',
    category_seed_key: 'part_a',
    title: 'Demonstration Record — Level I',
    level: 'Level I',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 5,
  },
  {
    seed_key: 'part_a_06_demonstration_l2',
    category_seed_key: 'part_a',
    title: 'Demonstration Record — Level II',
    level: 'Level II',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 6,
  },
  {
    seed_key: 'part_a_07_lesson_plan_l1',
    category_seed_key: 'part_a',
    title: 'Lesson Plan Record — Level I',
    level: 'Level I',
    status: 'Not Started',
    difficulty: 'Hard',
    priority: 'Normal',
    credits: 2,
    marks: 40,
    sort_order: 7,
  },
  {
    seed_key: 'part_a_08_lesson_plan_l2',
    category_seed_key: 'part_a',
    title: 'Lesson Plan Record — Level II',
    level: 'Level II',
    status: 'Not Started',
    difficulty: 'Hard',
    priority: 'Normal',
    credits: 2,
    marks: 40,
    sort_order: 8,
  },
  {
    seed_key: 'part_a_09_instructional_materials_l1',
    category_seed_key: 'part_a',
    title: 'Instructional Materials Record — Level I',
    level: 'Level I',
    status: 'Not Started',
    difficulty: 'Easy',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 9,
  },
  {
    seed_key: 'part_a_10_instructional_materials_l2',
    category_seed_key: 'part_a',
    title: 'Instructional Materials Record — Level II',
    level: 'Level II',
    status: 'Not Started',
    difficulty: 'Easy',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 10,
  },
  {
    seed_key: 'part_a_11_test_measurement_l1',
    category_seed_key: 'part_a',
    title: 'Test and Measurement Record — Level I',
    level: 'Level I',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 11,
  },
  {
    seed_key: 'part_a_12_test_measurement_l2',
    category_seed_key: 'part_a',
    title: 'Test and Measurement Record — Level II',
    level: 'Level II',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 0.5,
    marks: 10,
    sort_order: 12,
  },
  {
    seed_key: 'part_a_13_case_study',
    category_seed_key: 'part_a',
    title: 'Case Study Record',
    level: 'N/A',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 1,
    marks: 20,
    sort_order: 13,
  },
  {
    seed_key: 'part_a_14_psychology_practical',
    category_seed_key: 'part_a',
    title: 'Psychology Practical Record',
    level: 'N/A',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 2,
    marks: 40,
    sort_order: 14,
  },
  {
    seed_key: 'part_a_15_environmental_education',
    category_seed_key: 'part_a',
    title: 'Environmental Education Record',
    level: 'N/A',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 1,
    marks: 20,
    sort_order: 15,
  },
  {
    seed_key: 'part_a_16_student_portfolios',
    category_seed_key: 'part_a',
    title: 'Student Portfolios and Reflective Journals',
    level: 'N/A',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 1,
    marks: 20,
    sort_order: 16,
  },
  // Part B (4 tasks)
  {
    seed_key: 'part_b_17_reading_reflecting',
    category_seed_key: 'part_b',
    title: 'Reading and Reflecting on Texts',
    level: 'N/A',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 1,
    marks: 20,
    sort_order: 17,
  },
  {
    seed_key: 'part_b_18_drama_art',
    category_seed_key: 'part_b',
    title: 'Drama and Art in Education',
    level: 'N/A',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 1,
    marks: 20,
    sort_order: 18,
  },
  {
    seed_key: 'part_b_19_critical_ict',
    category_seed_key: 'part_b',
    title: 'Critical Understanding of ICT',
    level: 'N/A',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 1,
    marks: 20,
    sort_order: 19,
  },
  {
    seed_key: 'part_b_20_understanding_self',
    category_seed_key: 'part_b',
    title: 'Understanding the Self',
    level: 'N/A',
    status: 'Not Started',
    difficulty: 'Medium',
    priority: 'Normal',
    credits: 1,
    marks: 20,
    sort_order: 20,
  },
];
