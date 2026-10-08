const express = require("express");

const {
  getCompanies,
  getSingleCompany,
  createNewCompanyController,
  updateCompanyController,
} = require("../controllers/companyController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

const {
  authorize,
} = require("../middleware/authorizeMiddleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("SYSTEM.SETTINGS"),
  getCompanies
);

router.get(
  "/:id",
  authenticate,
  authorize("SYSTEM.SETTINGS"),
  getSingleCompany
);

router.post(
  "/",
  authenticate,
  authorize("SYSTEM.SETTINGS"),
  createNewCompanyController
);

router.patch(
  "/:id",
  authenticate,
  authorize("SYSTEM.SETTINGS"),
  updateCompanyController
);

module.exports = router;