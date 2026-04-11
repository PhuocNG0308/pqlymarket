import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { startIndexer } from "./services/indexer";

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`[PQlymarket] Server running at http://localhost:${PORT}`);

  // Start background event indexer (syncs blockchain trades into SQLite)
  startIndexer();
});
