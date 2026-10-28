const pool = require("../config/database");

/**
 * Executes multiple database operations inside
 * one PostgreSQL transaction.
 *
 * If the callback succeeds:
 *   COMMIT
 *
 * If the callback fails:
 *   ROLLBACK
 *
 * @param {Function} callback
 * @returns {Promise<any>}
 */

async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Transaction rollback failed:",
        rollbackError.message
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  withTransaction,
};
