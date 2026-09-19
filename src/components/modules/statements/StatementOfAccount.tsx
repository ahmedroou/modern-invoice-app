/**
 * Customer Statement of Account Component
 * 
 * Target: src/components/modules/statements/StatementOfAccount.tsx
 * Re-exports StatementGenerator as StatementOfAccount to satisfy both
 * PROJECT.md and user requirement naming conventions.
 */

import { StatementGenerator } from '@/components/modules/statements/StatementGenerator';

export { StatementGenerator as StatementOfAccount, StatementGenerator };
export default StatementGenerator;
