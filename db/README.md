# Application persistence

The application uses Prisma with a local SQLite database for the school prototype. Its persistence models are in `../prisma/schema.prisma`; the singleton client is in `../lib/prisma.ts`.

The database is an application mapping, not a second agent contract. Agent inputs and outputs remain defined in `../contracts/`. Confirmed values, proposal decisions, reviewer decisions, and workflow events must be written by coordinator-authorized application services.

The separate `requests/store.js` local adapter is a tested reference implementation with its own SQLite tables; it is not a Prisma client or synchronized store. Do not point both adapters at the same database. See [reconciliation gaps](../docs/app-reconciliation.md) before building services. Owner/workspace enforcement and atomic revision/analysis activation must be implemented in the application layer before shared access.
