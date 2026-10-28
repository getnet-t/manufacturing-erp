const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const companyRoutes = require("./routes/companyRoutes");
const factoryRoutes = require("./routes/factoryRoutes");
const unitOfMeasureRoutes = require("./routes/unitOfMeasureRoutes");
const productRoutes = require("./routes/productRoutes");
const productCategoryRoutes = require("./routes/productCategoryRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");

const bomRoutes = require("./routes/bomRoutes");
const productionRoutes = require("./routes/productionRoutes");
const qualityRoutes = require("./routes/qualityRoutes");


app.use(helmet());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Manufacturing ERP API is running",
    timestamp: new Date().toISOString(),
  });
});


app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/factories", factoryRoutes);
app.use("/api/uom", unitOfMeasureRoutes);
app.use("/api/products", productRoutes);
app.use("/api/product-categories", productCategoryRoutes);
app.use("/api/inventory", inventoryRoutes);

app.use("/api/boms", bomRoutes);
app.use("/api/production-orders", productionRoutes);
app.use("/api/quality", qualityRoutes);
module.exports = app;
