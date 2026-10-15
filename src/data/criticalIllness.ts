// Shared disease labels in the app's existing "English (Bengali)" form.
// Derived from the richer src/data/ciDiseases.ts module so there is a single
// source of truth for the wording; these string arrays exist for callers that
// expect the original flat label format.
import { CLASSIC_CI_DISEASES as C, MINOR_CI_DISEASES as Mi, MAJOR_CI_DISEASES as Ma, ciDiseaseLabel } from './ciDiseases';

export const CLASSIC_CI_DISEASES = C.map(ciDiseaseLabel);
export const MINOR_CI_DISEASES = Mi.map(ciDiseaseLabel);
export const MAJOR_CI_DISEASES = Ma.map(ciDiseaseLabel);
