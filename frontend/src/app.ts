import express from "express";
import expressLayouts from "express-ejs-layouts";
import path from "path";
import { pageRouter } from "./routes/index";
import { apiRouter } from "./routes/api";

export const app = express();

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(expressLayouts);
app.set("layout", "layout");

// Static files
app.use(express.static(path.join(__dirname, "../public")));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/", pageRouter);
app.use("/api", apiRouter);
