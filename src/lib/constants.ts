export const APP_NAME = "NRB World Event";
export const APP_SHORT_NAME = "NRB World";
export const APP_TAGLINE = "Event Registration, Verification & Check-in System";
export const DEFAULT_ID_PREFIX = "NRB";
export const DEFAULT_ID_YEAR = 2026;

export const COUNTRIES = [
  "Bangladesh",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Oman",
  "Bahrain",
  "Singapore",
  "Malaysia",
  "Japan",
  "South Korea",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Sweden",
  "Switzerland",
  "India",
  "Pakistan",
  "Nepal",
  "Sri Lanka",
  "China",
  "Indonesia",
  "Thailand",
  "Vietnam",
  "Philippines",
  "Kenya",
  "Nigeria",
  "South Africa",
  "New Zealand",
  "Brazil",
  "Mexico",
  "Turkey",
  "Egypt",
] as const;

export const SAMPLE_SCANS = [
  { id: "NRB20260001", label: "Registered (Green)" },
  { id: "NRB20260002", label: "Already In (Amber)" },
  { id: "NRB20999999", label: "Unknown ID (Red)" },
] as const;
