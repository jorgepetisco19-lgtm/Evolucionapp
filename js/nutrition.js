// Cálculo del metabolismo basal y del objetivo de kcal. Sin dependencias: son solo fórmulas.
// Es una ESTIMACIÓN orientativa (fórmula de Mifflin-St Jeor), no un consejo médico.

// Multiplicadores de actividad habituales (Harris-Benedict revisados).
export const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, athlete: 1.9 };
export const GOALS = ['lose', 'maintain', 'gain'];
export const PACES = { lose: [0.25, 0.5, 0.75], gain: [0.25, 0.5] }; // kg por semana
const KCAL_PER_KG = 7700;                                              // kcal aprox. por kg de peso corporal
const MIN_KCAL = { male: 1500, female: 1200 };                         // suelo de seguridad para una dieta de déficit

export function ageFrom(birth, today = new Date()) {
  if (!birth) return null;
  const [y, m, d] = String(birth).split('-').map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

export const bmi = (kg, cm) => (kg && cm ? kg / (cm / 100) ** 2 : null);

// Metabolismo basal: kcal que gastas en reposo en un día.
export function bmr({ sex, kg, cm, age }) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
}

/**
 * profile: { sex, birth_date, height_cm, activity, goal, pace, goal_weight_kg }
 * kg: peso actual. Devuelve null si faltan datos imprescindibles.
 * warnings: códigos ('minor', 'underweight', 'floor', 'fast', 'goalDirection') que la pantalla traduce.
 */
export function plan(profile, kg, today = new Date()) {
  if (!profile || !kg) return null;
  const age = ageFrom(profile.birth_date, today);
  const cm = Number(profile.height_cm);
  if (!age || age < 0 || age > 120 || !cm || (profile.sex !== 'male' && profile.sex !== 'female')) return null;
  const w = Number(kg);
  const base = bmr({ sex: profile.sex, kg: w, cm, age });
  const tdee = base * (ACTIVITY[profile.activity] || ACTIVITY.light);
  const warnings = [];
  let goal = GOALS.includes(profile.goal) ? profile.goal : 'maintain';
  const pace = Number(profile.pace) || 0.5;
  const index = bmi(w, cm);

  // Con menos de 18 años o peso bajo no se propone déficit: solo mantenimiento.
  if (goal === 'lose' && age < 18) { warnings.push('minor'); goal = 'maintain'; }
  if (goal === 'lose' && index < 18.5) { warnings.push('underweight'); goal = 'maintain'; }
  if (goal === 'gain' && age < 18) { warnings.push('minor'); goal = 'maintain'; }

  let delta = goal === 'lose' ? -(pace * KCAL_PER_KG) / 7 : goal === 'gain' ? (pace * KCAL_PER_KG) / 7 : 0;
  let target = tdee + delta;
  if (goal === 'lose') {
    const floor = Math.min(MIN_KCAL[profile.sex], tdee);
    if (target < floor) { target = floor; delta = target - tdee; warnings.push('floor'); }
    if (pace / w > 0.01) warnings.push('fast'); // más del 1 % del peso por semana
  }
  target = Math.round(target / 10) * 10;

  // Reparto orientativo: proteína 1,8 g/kg, grasa 25 % de las kcal, el resto hidratos.
  const protein = Math.round(1.8 * w);
  const fat = Math.round((target * 0.25) / 9);
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));

  // Semanas hasta el peso objetivo, si es coherente con el objetivo elegido.
  let weeks = null;
  const gw = Number(profile.goal_weight_kg);
  if (gw > 0 && goal !== 'maintain') {
    const diff = goal === 'lose' ? w - gw : gw - w;
    if (diff > 0) weeks = Math.ceil(diff / pace);
    else warnings.push('goalDirection');
  }
  return { age, bmi: index, bmr: Math.round(base), tdee: Math.round(tdee), target, delta: Math.round(delta), goal, pace, protein, fat, carbs, weeks, warnings };
}
