declare module 'node:sqlite' {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;

  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    all(...params: SQLInputValue[]): Array<Record<string, unknown>>;
    get(...params: SQLInputValue[]): Record<string, unknown> | undefined;
    run(...params: SQLInputValue[]): StatementResultingChanges;
  }

  export class DatabaseSync {
    constructor(location: string, options?: { open?: boolean; readOnly?: boolean });
    close(): void;
    exec(sql: string): void;
    open(): void;
    prepare(sql: string): StatementSync;
  }
}
