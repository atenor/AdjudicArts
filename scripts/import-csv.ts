require("tsconfig-paths/register");

const { readFile } = require("fs/promises");
const path = require("path");
const {
  getImportEventById,
  importApplicantsFromRows,
  parseApplicantCsv,
} = require("../lib/db/import");
const { prisma } = require("../lib/prisma");

async function main() {
  const [, , csvPathArg, eventId] = process.argv;

  if (!csvPathArg || !eventId) {
    console.error("Usage: npx ts-node scripts/import-csv.ts [csvPath] [eventId]");
    process.exit(1);
  }

  const csvPath = path.resolve(csvPathArg);
  const csvData = await readFile(csvPath, "utf8");
  const rows = parseApplicantCsv(csvData);

  if (rows.length === 0) {
    console.error("CSV has no data rows");
    process.exit(1);
  }

  const event = await getImportEventById(eventId);
  if (!event) {
    console.error(`Event not found: ${eventId}`);
    process.exit(1);
  }

  console.log(`Importing ${rows.length} rows into event: ${event.name} (${event.id})`);
  const result = await importApplicantsFromRows({
    rows,
    eventId,
    organizationId: event.organizationId,
  });

  console.log("\nImport complete");
  console.log(`Rows: ${result.totalRows}`);
  console.log(`Imported: ${result.imported}`);
  console.log(`Created users: ${result.createdUsers}`);
  console.log(`Created applications: ${result.createdApplications}`);
  console.log(`Updated applications: ${result.updatedApplications}`);
  console.log(`Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    for (const entry of result.errors) {
      console.log(`- Row ${entry.row}${entry.email ? ` (${entry.email})` : ""}: ${entry.message}`);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error("Import failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
