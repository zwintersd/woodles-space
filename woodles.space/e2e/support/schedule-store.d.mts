export function scheduleStore(): {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;
  publications: Map<string, any>; revisions: Map<string, any>; sessions: Map<string, any>; attempts: Map<string, any>;
  calls: { q: string; values: any[] }[];
};
