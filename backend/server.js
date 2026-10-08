require("dotenv").config();

const app = require("./src/app");
const pool = require("./src/config/database");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await pool.query("SELECT 1");

    console.log("PostgreSQL connected successfully");

    app.listen(PORT, () => {
      console.log(
        `Manufacturing ERP API running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:");
    console.error(error.message);

    process.exit(1);
  }
}

startServer();