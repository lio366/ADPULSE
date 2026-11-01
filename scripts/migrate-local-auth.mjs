import "dotenv/config";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(2);
}

const connection = await mysql.createConnection(databaseUrl, { multipleStatements: true });
try {
  const migration = await readFile(new URL("../0005_real_authentication.sql", import.meta.url), "utf8");
  await connection.query(migration);
  console.log("Local authentication schema applied.");
} finally {
  await connection.end();
}