const {
getUnits,
getUnit,
createNewUnit,
updateExistingUnit,
} = require("../services/unitOfMeasureService");

async function getAllUnits(req, res) {
  try {
    const units = await getUnits(req.user.companyId);

    return res.json({
      success: true,
      data: { units },
    });
  } catch (error) {
    console.error("Get units error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function getSingleUnit(req, res) {
try {
const unitId = Number(req.params.id);


const unit = await getUnit(
  unitId,
  req.user.companyId
);

return res.json({
  success: true,
  data: { unit },
});


} catch (error) {
console.error("Get unit error:", error);


if (
  error.message === "Unit of measure not found" ||
  error.message === "Invalid unit ID"
) {
  return res.status(404).json({
    success: false,
    message: error.message,
  });
}

return res.status(500).json({
  success: false,
  message: "Internal server error",
});


}
}

async function createUnitController(req, res) {
try {
const { code, name, dimension } = req.body;


const unit = await createNewUnit({
  companyId: req.user.companyId,
  code,
  name,
  dimension,
});

return res.status(201).json({
  success: true,
  message: "Unit of measure created successfully",
  data: { unit },
});

} catch (error) {
console.error("Create unit error:", error);


if (
  error.message.includes("required") ||
  error.message.includes("cannot") ||
  error.message.includes("exceed") ||
  error.message.includes("Invalid dimension") ||
  error.message.includes("Allowed values") ||
  error.message.includes("already exists")
) {
  return res.status(400).json({
    success: false,
    message: error.message,
  });
}

return res.status(500).json({
  success: false,
  message: "Internal server error",
});


}
}

async function updateUnitController(req, res) {
try {
const unitId = Number(req.params.id);

const { name, dimension, status } = req.body;

const unit = await updateExistingUnit(
  unitId,
  req.user.companyId,
  { name, dimension, status }
);

return res.json({
  success: true,
  message: "Unit of measure updated successfully",
  data: { unit },
});


} catch (error) {
console.error("Update unit error:", error);


if (
  error.message === "Unit of measure not found" ||
  error.message === "Invalid unit ID"
) {
  return res.status(404).json({
    success: false,
    message: error.message,
  });
}

if (
  error.message.includes("cannot") ||
  error.message.includes("Invalid dimension") ||
  error.message.includes("Allowed values") ||
  error.message.includes("Status must") ||
  error.message.includes("exceed")
) {
  return res.status(400).json({
    success: false,
    message: error.message,
  });
}

return res.status(500).json({
  success: false,
  message: "Internal server error",
});


}
}

module.exports = {
getAllUnits,
getSingleUnit,
createUnitController,
updateUnitController,
};
