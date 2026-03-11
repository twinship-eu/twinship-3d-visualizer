import type { ObjectDetails } from "./components/selection-details-modal-types";

/** Main Propeller details – shown for any selection for now. */
const MAIN_PROPELLER_DETAILS: ObjectDetails = {
  title: "Main Propeller",
  tags: ["Propulsion", "Propulsion System"],
  description:
    "Five-blade controllable pitch propeller optimized for efficiency across varying operational speeds. Manufactured from nickel-aluminum-bronze alloy.",
  parameters: [
    { name: "Type", value: "Controllable Pitch" },
    { name: "Blades", value: "5" },
    { name: "Diameter", value: "5.2 m" },
    { name: "Material", value: "NiAl Bronze (CU3)" },
    { name: "Design Speed", value: "18.5 knots" },
    { name: "RPM Range", value: "80-145 RPM" },
  ],
  connectedComponents: [
    { id: "prop-shaft", label: "Propeller Shaft", category: "Propulsion" },
    { id: "prop-gearbox", label: "Reduction Gearbox", category: "Propulsion" },
    { id: "prop-engine", label: "Main Engine", category: "Propulsion" },
  ],
};

/** Mock object details by node id. Used for description, parameters, and connected components. */
export const MOCK_OBJECT_DETAILS: Record<string, ObjectDetails> = {
  "prop-propeller": MAIN_PROPELLER_DETAILS,
  "prop-engine": {
    description:
      "Main propulsion diesel engine. Four-stroke, turbocharged, suitable for marine applications.",
    parameters: [
      { name: "Type", value: "Diesel" },
      { name: "Cylinders", value: "6" },
      { name: "Max Power", value: "2,500 kW" },
      { name: "RPM", value: "750" },
    ],
    connectedComponents: [
      { id: "prop-gearbox", label: "Reduction Gearbox", category: "Propulsion" },
      { id: "prop-propeller", label: "Propeller", category: "Propulsion" },
    ],
  },
};

/** Returns Main Propeller details for any selection for now. */
export function getObjectDetails(_nodeId: string): ObjectDetails {
  return MAIN_PROPELLER_DETAILS;
}
