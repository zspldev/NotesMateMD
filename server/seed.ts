import { db } from "./db";
import { orgs, employees, patients, visits, visit_notes } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seed() {
  console.log("Seeding database...");

  // Check if data already exists
  const existingOrgs = await db.select().from(orgs);
  if (existingOrgs.length > 0) {
    console.log("Database already seeded. Skipping...");
    return;
  }

  // Seed organizations
  const org1Id = "550e8400-e29b-41d4-a716-446655440000";
  await db.insert(orgs).values({
    orgid: org1Id,
    org_name: "Metropolitan Medical Center",
    org_type: "hospital",
    address: "123 Health St, Medical City, MC 12345",
    phone: "555-0100"
  });

  // Seed employees
  const emp1Id = "660e8400-e29b-41d4-a716-446655440000";
  const passwordHash = await bcrypt.hash("password123", 10);
  
  await db.insert(employees).values({
    empid: emp1Id,
    orgid: org1Id,
    username: "dr.smith@medcenter.com",
    password_hash: passwordHash,
    first_name: "Jane",
    last_name: "Smith",
    title: "Doctor"
  });

  // Seed patients
  await db.insert(patients).values([
    {
      patientid: "MRN001234",
      orgid: org1Id,
      first_name: "John",
      last_name: "Doe",
      date_of_birth: "1980-05-15",
      gender: "Male",
      contact_info: "Phone: 555-0123, Email: john.doe@email.com"
    },
    {
      patientid: "MRN005678",
      orgid: org1Id,
      first_name: "Emily",
      last_name: "Johnson",
      date_of_birth: "1992-08-22",
      gender: "Female",
      contact_info: "Phone: 555-0456, Email: emily.j@email.com"
    }
  ]);

  console.log("✅ Database seeded successfully!");
  console.log("Login credentials:");
  console.log("  Username: dr.smith@medcenter.com");
  console.log("  Password: password123");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  });
