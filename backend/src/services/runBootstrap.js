require("dotenv").config();

const pool = require("../config/database");
const { bootstrapSystem } = require("./bootstrapService");

async function runBootstrap() {
  try {
    console.log("Starting real ERP bootstrap...\n");

    const result = await bootstrapSystem({
      companyCode: "MFG-001",
      companyName: "my Manufacturing Company",
      adminName: "Getnet Tesfa",
      adminEmail: "gtesfa079@gmail.com",
      adminPassword: "123abc@#$",
    });

    console.log("ERP bootstrap completed successfully.\n");

    console.log("Company:");
    console.log(result.company);

    console.log("\nAdministrator:");
    console.log(result.user);

    console.log(
      "\nPermissions created:",
      result.permissionsCreated
    );

    console.log("\nSystem is ready.");
  } catch (error) {
    console.error("\nBootstrap failed:");
    console.error(error.message);
  } finally {
    await pool.end();
  }
}

runBootstrap();
// admin eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyIiwiY29tcGFueUlkIjoiMiIsImlhdCI6MTc5MTQ2MTAxOSwiZXhwIjoxNzkxNTQ3NDE5fQ.EQa5KO3SVM1m6BHrhJVRJciH33alRIkYRmCSOMzCQ64"