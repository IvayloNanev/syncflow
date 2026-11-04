# Application persistence

The application uses Prisma with a local SQLite database for the school prototype. Its persistence models are in `../prisma/schema.prisma`; the singleton client is in `../lib/prisma.ts`.

The database is an application mapping, not a second agent contract. Agent inputs and outputs remain defined in `../contracts/`. Confirmed values, proposal decisions, reviewer decisions, and workflow events must be written by coordinator-authorized application services.
