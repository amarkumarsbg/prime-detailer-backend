import { prisma } from "../src/lib/prisma.js";
import { listCustomers } from "../src/modules/customers/customer.service.js";
import { listVehiclesApi } from "../src/modules/vehicles/vehicle-api.service.js";
import { listCollectionItems } from "../src/modules/collections/app-json-store.js";
import { getBootstrapPayload } from "../src/modules/bootstrap/bootstrap.service.js";
import { replaceJobCards } from "../src/modules/job-cards/job-cards.service.js";

async function measure(name: string, fn: () => Promise<any>) {
  const start = performance.now();
  await fn();
  const end = performance.now();
  console.log(`${name} | ${(end - start).toFixed(2)}ms`);
}

async function run() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.log("No organization found to measure against.");
    process.exit(0);
  }
  const orgId = org.id;
  console.log(`Measuring for org: ${orgId}`);

  // Create some dummy data if needed
  const jc = await listCollectionItems("jobCards", { organizationId: orgId });
  const mockJc = Array.isArray(jc) && jc.length > 0 ? jc.slice(0, 50) : [];
  
  if (mockJc.length === 0) {
    // Insert some mock job cards for replacement test
    for (let i = 0; i < 50; i++) {
      mockJc.push({
        id: `mock-jc-${i}`,
        jobNumber: `JC-${i}`,
        status: "OPEN"
      });
    }
  }

  await measure("GET /api/customers", () => listCustomers({ organizationId: orgId }));
  await measure("GET /api/vehicles", () => listVehiclesApi({ organizationId: orgId }));
  await measure("GET /api/collections/jobCards", () => listCollectionItems("jobCards", { organizationId: orgId }));
  await measure("GET /api/collections/invoices", () => listCollectionItems("invoices", { organizationId: orgId }));
  await measure("GET /api/organization/bootstrap", () => getBootstrapPayload({ id: "mock-user", email: "mock@mock.com", role: "ADMIN", branchId: "br-main", organizationId: orgId, name: "Mock" }));
  
  await measure("PUT /api/job-cards/replace (50 items)", () => replaceJobCards(mockJc as any, { organizationId: orgId, hasPricingPermission: true }));

  console.log("Done.");
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
