const express = require("express");

const {
getAllUnits,
getSingleUnit,
createUnitController,
updateUnitController,
} = require("../controllers/unitOfMeasureController");

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
authorize("PRODUCT.READ"),
getAllUnits
);

router.get(
"/:id",
authenticate,
authorize("PRODUCT.READ"),
getSingleUnit
);

router.post(
"/",
authenticate,
authorize("PRODUCT.CREATE"),
createUnitController
);

router.patch(
"/:id",
authenticate,
authorize("PRODUCT.UPDATE"),
updateUnitController
);

module.exports = router;
