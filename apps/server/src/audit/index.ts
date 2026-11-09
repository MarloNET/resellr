// Public interface of `audit` (Technical Specification 4.1, exception (4), Nachtrag MAR-285):
// the audit writer for every service that stores a change to be logged (3.6).
export { createAuditWriter, type AuditEntryInput, type AuditWriter } from './audit-writer.ts';
