// Campos de la composición corporal que da una báscula inteligente.
// syn = textos con los que suele aparecer cada campo en las apps de básculas (es/en).
// min/max = rango razonable; sirve para corregir un punto decimal que el OCR no vio.
export const FIELDS = [
  { key: 'weight_kg', unit: 'kg', min: 20, max: 300, step: 0.01, syn: ['peso', 'weight', 'peso total'] },
  { key: 'bmi', unit: '', min: 10, max: 60, step: 0.1, syn: ['imc', 'bmi', 'indice de masa corporal'] },
  { key: 'body_fat_pct', unit: '%', min: 3, max: 70, step: 0.1, syn: ['grasa corporal', 'body fat', 'porcentaje de grasa', 'body fat rate'] },
  { key: 'skeletal_muscle_pct', unit: '%', min: 20, max: 80, step: 0.1, syn: ['musculo esqueletico', 'skeletal muscle', 'skeletal muscle rate'] },
  { key: 'lean_mass_kg', unit: 'kg', min: 15, max: 200, step: 0.01, syn: ['peso corporal sin grasa', 'masa magra', 'masa libre de grasa', 'lean body mass', 'fat free weight', 'peso magro'] },
  { key: 'subcutaneous_fat_pct', unit: '%', min: 2, max: 60, step: 0.1, syn: ['grasa subcutanea', 'subcutaneous fat'] },
  { key: 'visceral_fat', unit: '', min: 1, max: 30, step: 1, syn: ['grasa visceral', 'visceral fat'] },
  { key: 'body_water_pct', unit: '%', min: 20, max: 80, step: 0.1, syn: ['agua corporal', 'body water', 'water', 'agua'] },
  { key: 'muscle_mass_kg', unit: 'kg', min: 10, max: 150, step: 0.01, syn: ['masa muscular', 'muscle mass'] },
  { key: 'bone_mass_kg', unit: 'kg', min: 0.5, max: 8, step: 0.01, syn: ['masa osea', 'bone mass', 'masa de huesos'] },
  { key: 'protein_pct', unit: '%', min: 5, max: 35, step: 0.1, syn: ['proteina', 'protein'] },
  { key: 'bmr_kcal', unit: 'kcal', min: 700, max: 4500, step: 1, syn: ['tasa metabolica basal', 'metabolismo basal', 'basal metabolic rate', 'bmr', 'tmb'] },
  { key: 'metabolic_age', unit: '', min: 8, max: 90, step: 1, syn: ['edad metabolica', 'metabolic age', 'edad corporal', 'body age'] },
];

export const FIELD_KEYS = FIELDS.map((f) => f.key);

// Medidas con cinta métrica (cm).
export const MEASURES = ['waist_cm', 'hip_cm', 'chest_cm', 'arm_cm', 'thigh_cm'];
