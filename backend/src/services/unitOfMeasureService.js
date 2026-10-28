const {
findUnitsByCompany,
findUnitById,
findUnitByCode,
createUnit,
updateUnit,
} = require("../repositories/unitOfMeasureRepository");

const VALID_DIMENSIONS = [
"COUNT",
"WEIGHT",
"LENGTH",
"AREA",
"VOLUME",
"TIME",
];

const VALID_STATUSES = ["ACTIVE", "INACTIVE"];

async function getUnits(companyId) {
return findUnitsByCompany(companyId);
}

async function getUnit(unitId, companyId) {
if (!Number.isSafeInteger(unitId) || unitId <= 0) {
throw new Error("Invalid unit ID");
}

const unit = await findUnitById(unitId, companyId);

if (!unit) {
throw new Error("Unit of measure not found");
}

return unit;
}

async function createNewUnit({
companyId,
code,
name,
dimension,
}) {
if (
typeof code !== "string" ||
typeof name !== "string" ||
typeof dimension !== "string"
) {
throw new Error("Code, name, and dimension are required");
}

const normalizedCode = code.trim().toUpperCase();
const normalizedName = name.trim();
const normalizedDimension = dimension.trim().toUpperCase();

if (!normalizedCode || !normalizedName) {
throw new Error("Code and name cannot be empty");
}

if (normalizedCode.length > 50) {
throw new Error("Code cannot exceed 50 characters");
}

if (normalizedName.length > 100) {
throw new Error("Name cannot exceed 100 characters");
}

if (!VALID_DIMENSIONS.includes(normalizedDimension)) {
throw new Error(
`Invalid dimension. Allowed values: ${VALID_DIMENSIONS.join(", ")}`
);
}

const existingUnit = await findUnitByCode(
normalizedCode,
companyId
);

if (existingUnit) {
throw new Error("Unit code already exists");
}

return createUnit({
companyId,
code: normalizedCode,
name: normalizedName,
dimension: normalizedDimension,
});
}

async function updateExistingUnit(
unitId,
companyId,
{ name, dimension, status }
) {
if (!Number.isSafeInteger(unitId) || unitId <= 0) {
throw new Error("Invalid unit ID");
}

const existingUnit = await findUnitById(unitId, companyId);

if (!existingUnit) {
throw new Error("Unit of measure not found");
}

let normalizedName;
let normalizedDimension;
let normalizedStatus;

if (name !== undefined) {
if (typeof name !== "string" || !name.trim()) {
throw new Error("Unit name cannot be empty");
}


normalizedName = name.trim();

if (normalizedName.length > 100) {
  throw new Error("Name cannot exceed 100 characters");
}


}

if (dimension !== undefined) {
if (typeof dimension !== "string") {
throw new Error("Invalid dimension");
}


normalizedDimension = dimension.trim().toUpperCase();

if (!VALID_DIMENSIONS.includes(normalizedDimension)) {
  throw new Error(
    `Invalid dimension. Allowed values: ${VALID_DIMENSIONS.join(", ")}`
  );
}


}

if (status !== undefined) {
if (typeof status !== "string") {
throw new Error("Invalid status");
}


normalizedStatus = status.trim().toUpperCase();

if (!VALID_STATUSES.includes(normalizedStatus)) {
  throw new Error("Status must be ACTIVE or INACTIVE");
}


}

return updateUnit(unitId, companyId, {
name: normalizedName,
dimension: normalizedDimension,
status: normalizedStatus,
});
}

module.exports = {
getUnits,
getUnit,
createNewUnit,
updateExistingUnit,
};
