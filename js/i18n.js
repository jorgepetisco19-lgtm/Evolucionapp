// Textos de la app en español (por defecto) e inglés.
const es = {
  'common.close': 'Cerrar', 'common.error': 'Algo ha fallado al cargar esta pantalla.', 'common.retry': 'Reintentar',
  'common.date': 'Fecha', 'common.save': 'Guardar', 'common.saved': 'Guardado', 'common.delete': 'Borrar', 'common.deleted': 'Borrado',
  'common.edit': 'Editar', 'common.confirmDelete': '¿Seguro que quieres borrarlo? No se puede deshacer.',

  'nav.home': 'Inicio', 'nav.body': 'Cuerpo', 'nav.photos': 'Fotos', 'nav.food': 'Comidas', 'nav.sport': 'Deporte', 'nav.settings': 'Ajustes',

  'cal.prev': 'Mes anterior', 'cal.next': 'Mes siguiente', 'cal.weight': 'Peso', 'cal.measures': 'Medidas', 'cal.photos': 'Fotos',
  'cal.meals': 'Comidas', 'cal.workouts': 'Deporte',

  'login.tagline': 'Tu peso, tus fotos, tus comidas y tus entrenos en un solo sitio, para ver cómo evolucionas.',
  'login.google': 'Continuar con Google', 'login.privacy': 'Privacidad', 'login.terms': 'Condiciones',

  'home.today': 'Hoy', 'home.compare': 'Comparar dos fechas', 'home.open': 'Abrir', 'home.add': 'Añadir', 'home.empty': 'Sin registro',

  'body.weight': 'Peso', 'body.measures': 'Medidas', 'body.fromCapture': 'Desde captura', 'body.addManual': 'Manual',
  'body.emptyWeight': 'Aún no hay pesos. Haz una captura de tu app de báscula y súbela, o añádelo a mano.',
  'body.emptyMeasures': 'Aún no hay medidas. Añade las de tu cinta métrica.',
  'body.current': 'Actual', 'body.vsPrev': 'Vs. anterior', 'body.total': 'Desde el inicio', 'body.metric': 'Dato a mostrar',
  'body.range.30': '30 d', 'body.range.90': '90 d', 'body.range.all': 'Todo', 'body.history': 'Historial',
  'body.formWeight': 'Registro de peso', 'body.formMeasures': 'Registro de medidas',
  'body.exists': 'Ya hay un registro en esta fecha: al guardar se reemplazará.',
  'body.badValue': 'Valor no válido en {f}', 'body.needDate': 'Elige una fecha.', 'body.needValue': 'Rellena al menos un dato.',

  'ocr.title': 'Leyendo la captura', 'ocr.reading': 'Leyendo la captura…', 'ocr.stage.load': 'Preparando la imagen…',
  'ocr.stage.engine': 'Cargando el lector (la primera vez tarda un poco)…', 'ocr.stage.numbers': 'Leyendo los números…',
  'ocr.found': 'He leído {n} de {total} datos. Revísalos antes de guardar.',
  'ocr.none': 'No he podido leer datos en esta imagen. Puedes rellenarlos a mano.',
  'ocr.lowHint': 'Los campos marcados en naranja son los que menos seguro estoy: compáralos con la captura.',
  'ocr.failed': 'No se pudo leer la captura. Rellénalo a mano.',

  'f.weight_kg': 'Peso', 'f.bmi': 'IMC', 'f.body_fat_pct': 'Grasa corporal', 'f.skeletal_muscle_pct': 'Músculo esquelético',
  'f.lean_mass_kg': 'Peso sin grasa', 'f.subcutaneous_fat_pct': 'Grasa subcutánea', 'f.visceral_fat': 'Grasa visceral',
  'f.body_water_pct': 'Agua corporal', 'f.muscle_mass_kg': 'Masa muscular', 'f.bone_mass_kg': 'Masa ósea', 'f.protein_pct': 'Proteína',
  'f.bmr_kcal': 'Metabolismo basal', 'f.metabolic_age': 'Edad metabólica',
  'f.waist_cm': 'Cintura', 'f.hip_cm': 'Cadera', 'f.chest_cm': 'Pecho', 'f.arm_cm': 'Brazo', 'f.thigh_cm': 'Muslo',

  'photos.gallery': 'Galería', 'photos.compare': 'Comparar', 'photos.add': 'Añadir foto', 'photos.all': 'Todas',
  'photos.empty': 'Aún no hay fotos. Sube una frontal, una lateral y una de espalda para poder compararlas.',
  'photos.type': 'Tipo de foto', 'photos.picture': 'Imagen', 'photos.choose': 'Hacer o elegir foto',
  'photos.hint': 'La foto se reduce antes de subirla para ahorrar datos y espacio. Solo tú puedes verla.',
  'photos.uploading': 'Subiendo…', 'photos.confirmDelete': '¿Borrar esta foto?',
  'photos.kind.front': 'Frontal', 'photos.kind.side': 'Lateral', 'photos.kind.back': 'Espalda',

  'cmp.help': 'Elige el tipo de foto y toca dos días del calendario: A y B.', 'cmp.choose': 'Elegir',
  'cmp.pickBoth': 'Elige dos fechas para compararlas.', 'cmp.noPhoto': 'Sin foto de este tipo ese día',
  'cmp.before': 'Antes', 'cmp.after': 'Después', 'cmp.days': '{n} días entre las dos fechas', 'cmp.differences': 'Diferencias',
  'cmp.noData': 'No hay pesos ni medidas registrados cerca de esas fechas.',

  'food.day': 'Diario', 'food.recipes': 'Recetas', 'food.protein': 'Proteínas', 'food.carbs': 'Hidratos', 'food.fat': 'Grasas',
  'food.add': 'Añadir comida', 'food.empty': 'Aún no has registrado comidas este día.',
  'food.type.breakfast': 'Desayuno', 'food.type.lunch': 'Comida', 'food.type.dinner': 'Cena', 'food.type.snack': 'Snack', 'food.type.other': 'Otro',
  'food.myRecipes': 'Mis recetas', 'food.newMeal': 'Nueva comida', 'food.noRecipes': 'Todavía no tienes recetas guardadas.',
  'food.servings': 'Raciones', 'food.addShort': 'Añadir', 'food.newRecipe': 'Nueva receta', 'food.editRecipe': 'Editar receta',
  'food.recipeName': 'Nombre de la receta', 'food.mealName': 'Nombre (opcional)', 'food.namePh': 'Pollo con arroz',
  'food.noItems': 'Añade ingredientes con el buscador o a mano.', 'food.searchPh': 'Buscar alimento (arroz, pollo…)',
  'food.search': 'Buscar', 'food.searching': 'Buscando en Open Food Facts…', 'food.noResults': 'Sin resultados. Prueba otra palabra o añádelo a mano.',
  'food.searchFailed': 'No se pudo consultar Open Food Facts. Revisa tu conexión o añade el alimento a mano.',
  'food.manual': '+ Añadir ingrediente a mano', 'food.hideManual': 'Ocultar', 'food.ingName': 'Nombre', 'food.grams': 'Gramos',
  'food.addIngredient': 'Añadir ingrediente', 'food.saveAsRecipe': 'Guardar también como receta', 'food.addToDay': 'Añadir al día',
  'food.needIng': 'Pon al menos nombre y kcal por 100 g.', 'food.needItems': 'Añade al menos un ingrediente.', 'food.needName': 'Ponle un nombre a la receta.',

  'sport.day': 'Diario', 'sport.routines': 'Rutinas', 'sport.todayIs': 'Hoy toca:', 'sport.add': 'Registrar entreno', 'sport.edit': 'Editar entreno',
  'sport.empty': 'Sin entrenos este día.',
  'sport.type.gym': 'Gimnasio', 'sport.type.padel': 'Pádel', 'sport.type.walk': 'Caminar', 'sport.type.other': 'Otro',
  'sport.fromRoutine': 'Usar una rutina', 'sport.noRoutine': 'Sin rutina (en blanco)', 'sport.nameOpt': 'Nombre (opcional)',
  'sport.duration': 'Duración (min)', 'sport.notes': 'Notas', 'sport.exercise': 'Ejercicio', 'sport.exercisePh': 'Press banca',
  'sport.reps': 'Reps', 'sport.addSet': 'Serie', 'sport.addExercise': 'Añadir ejercicio',
  'profile.link': 'Mi perfil y objetivo de kcal', 'profile.linkHelp': 'Calcula tu metabolismo basal y cuánto comer',
  'profile.title': 'Mi perfil', 'profile.back': 'Ajustes', 'profile.intro': 'Cuéntanos de dónde partes y calculamos una referencia de cuántas kcal gastas y cuántas comer para tu objetivo.',
  'profile.sex': 'Sexo', 'profile.male': 'Hombre', 'profile.female': 'Mujer', 'profile.birth': 'Fecha de nacimiento', 'profile.height': 'Altura (cm)',
  'profile.weight': 'Peso de partida (kg)', 'profile.weightUsed': 'Usamos tu último peso registrado: {kg} kg ({date}). El de partida solo sirve si aún no has registrado ninguno.',
  'profile.activity': 'Actividad en tu día a día (con el deporte incluido)',
  'profile.act.sedentary': 'Sedentario: casi sin ejercicio', 'profile.act.light': 'Ligera: 1-3 días de ejercicio',
  'profile.act.moderate': 'Moderada: 3-5 días de ejercicio', 'profile.act.high': 'Alta: 6-7 días de ejercicio',
  'profile.act.athlete': 'Muy alta: entreno fuerte o trabajo físico',
  'profile.goal': 'Objetivo', 'profile.goal.lose': 'Perder peso', 'profile.goal.maintain': 'Mantener', 'profile.goal.gain': 'Ganar peso',
  'profile.pace': 'Ritmo', 'profile.pace.0.25': 'Suave · 0,25 kg/sem', 'profile.pace.0.5': 'Moderado · 0,5 kg/sem', 'profile.pace.0.75': 'Rápido · 0,75 kg/sem',
  'profile.goalWeight': 'Peso objetivo (kg, opcional)', 'profile.save': 'Guardar perfil', 'profile.saved': 'Perfil guardado',
  'profile.needData': 'Rellena sexo, fecha de nacimiento, altura y peso para ver tu estimación.', 'profile.needSaveFirst': 'Falta sexo, fecha de nacimiento, altura o peso.',
  'profile.result': 'Tu estimación', 'profile.target': 'Objetivo diario', 'profile.bmr': 'Metabolismo basal', 'profile.bmrHelp': 'lo que gastas en reposo',
  'profile.tdee': 'Mantenimiento', 'profile.tdeeHelp': 'lo que gastas al día con tu actividad', 'profile.adjust': 'Ajuste diario',
  'profile.scaleBmr': 'Tu báscula estima un basal de {n} kcal (sirve de referencia).', 'profile.macros': 'Reparto orientativo', 'profile.bmi': 'IMC',
  'profile.eta': 'Para llegar a {kg} kg a este ritmo: unas {n} semanas (hacia el {date}).',
  'profile.w.minor': 'Con menos de 18 años no proponemos déficit ni superávit: te mostramos solo el mantenimiento. Habla con tu médico o un dietista.',
  'profile.w.underweight': 'Tu IMC es bajo, así que no proponemos perder peso: te mostramos el mantenimiento. Consulta con un profesional.',
  'profile.w.floor': 'Hemos limitado el déficit para no bajar de un mínimo razonable de kcal. Con tu perfil, perder más rápido no es recomendable.',
  'profile.w.fast': 'Ese ritmo supera el 1 % de tu peso por semana; es exigente y difícil de mantener. Un ritmo moderado suele ir mejor.',
  'profile.w.goalDirection': 'Tu peso objetivo no coincide con el objetivo elegido, así que no calculamos el plazo.',
  'profile.disclaimer': 'Estimación orientativa con la fórmula de Mifflin-St Jeor y la regla de 7.700 kcal por kg. Cada cuerpo responde distinto: ajusta según cómo evolucione tu peso. No sustituye el consejo de un médico o dietista, sobre todo con embarazo, lactancia o enfermedades.',
  'food.goal': 'Objetivo', 'food.left': 'Te quedan {n} kcal', 'food.over': 'Te pasas {n} kcal', 'food.setGoal': 'Calcula tu objetivo de kcal',
  'sport.unit': 'Medir en', 'sport.unitKg': 'Kilos (kg)', 'sport.unitSec': 'Segundos', 'sport.sec': 'Seg',
  'sport.saveAsRoutine': 'Guardar también como rutina', 'sport.saveAsRoutineHint': 'Si ya tienes una rutina con ese nombre, se actualiza con estos ejercicios.',
  'sport.routineNameReq': 'Ponle un nombre a la rutina', 'sport.routineNeedsEx': 'Añade al menos un ejercicio para guardar la rutina', 'sport.savedWithRoutine': 'Entreno y rutina guardados',
  'sport.newRoutine': 'Nueva rutina', 'sport.editRoutine': 'Editar rutina', 'sport.noRoutines': 'Crea tus rutinas (por ejemplo "Pecho y tríceps") y úsalas cada vez que entrenes.',
  'sport.noExercises': 'Sin ejercicios', 'sport.routineName': 'Nombre de la rutina', 'sport.routinePh': 'Pecho y tríceps',
  'sport.weekday': 'Día de la semana', 'sport.anyDay': 'Sin día fijo',

  'settings.language': 'Idioma', 'settings.theme': 'Apariencia', 'settings.theme.auto': 'Automático', 'settings.theme.light': 'Claro', 'settings.theme.dark': 'Oscuro',
  'settings.install': 'Instalar en el móvil', 'settings.installHelp': 'Añade Evolucionapp a tu pantalla de inicio como una app más.',
  'settings.installBtn': 'Instalar', 'settings.installManual': 'En Chrome: menú ⋮ → "Instalar app" o "Añadir a la pantalla de inicio".',
  'settings.account': 'Cuenta', 'settings.logout': 'Cerrar sesión',
};

const en = {
  'common.close': 'Close', 'common.error': 'Something went wrong loading this screen.', 'common.retry': 'Retry',
  'common.date': 'Date', 'common.save': 'Save', 'common.saved': 'Saved', 'common.delete': 'Delete', 'common.deleted': 'Deleted',
  'common.edit': 'Edit', 'common.confirmDelete': 'Delete it for good? This cannot be undone.',

  'nav.home': 'Home', 'nav.body': 'Body', 'nav.photos': 'Photos', 'nav.food': 'Meals', 'nav.sport': 'Sport', 'nav.settings': 'Settings',

  'cal.prev': 'Previous month', 'cal.next': 'Next month', 'cal.weight': 'Weight', 'cal.measures': 'Measures', 'cal.photos': 'Photos',
  'cal.meals': 'Meals', 'cal.workouts': 'Sport',

  'login.tagline': 'Your weight, photos, meals and workouts in one place, so you can see how you evolve.',
  'login.google': 'Continue with Google', 'login.privacy': 'Privacy', 'login.terms': 'Terms',

  'home.today': 'Today', 'home.compare': 'Compare two dates', 'home.open': 'Open', 'home.add': 'Add', 'home.empty': 'Nothing logged',

  'body.weight': 'Weight', 'body.measures': 'Measures', 'body.fromCapture': 'From screenshot', 'body.addManual': 'Manual',
  'body.emptyWeight': 'No weigh-ins yet. Upload a screenshot from your scale app, or add one by hand.',
  'body.emptyMeasures': 'No measurements yet. Add the ones from your tape measure.',
  'body.current': 'Current', 'body.vsPrev': 'Vs. previous', 'body.total': 'Since start', 'body.metric': 'Metric to show',
  'body.range.30': '30 d', 'body.range.90': '90 d', 'body.range.all': 'All', 'body.history': 'History',
  'body.formWeight': 'Weigh-in', 'body.formMeasures': 'Measurements',
  'body.exists': 'There is already a record on this date: saving will replace it.',
  'body.badValue': 'Invalid value in {f}', 'body.needDate': 'Pick a date.', 'body.needValue': 'Fill in at least one value.',

  'ocr.title': 'Reading the screenshot', 'ocr.reading': 'Reading the screenshot…', 'ocr.stage.load': 'Preparing the image…',
  'ocr.stage.engine': 'Loading the reader (first time takes a moment)…', 'ocr.stage.numbers': 'Reading the numbers…',
  'ocr.found': 'I read {n} of {total} values. Please check them before saving.',
  'ocr.none': 'I could not read any values from this image. You can fill them in by hand.',
  'ocr.lowHint': 'Fields in orange are the ones I am least sure about: compare them with the screenshot.',
  'ocr.failed': 'The screenshot could not be read. Fill it in by hand.',

  'f.weight_kg': 'Weight', 'f.bmi': 'BMI', 'f.body_fat_pct': 'Body fat', 'f.skeletal_muscle_pct': 'Skeletal muscle',
  'f.lean_mass_kg': 'Lean body mass', 'f.subcutaneous_fat_pct': 'Subcutaneous fat', 'f.visceral_fat': 'Visceral fat',
  'f.body_water_pct': 'Body water', 'f.muscle_mass_kg': 'Muscle mass', 'f.bone_mass_kg': 'Bone mass', 'f.protein_pct': 'Protein',
  'f.bmr_kcal': 'Basal metabolic rate', 'f.metabolic_age': 'Metabolic age',
  'f.waist_cm': 'Waist', 'f.hip_cm': 'Hip', 'f.chest_cm': 'Chest', 'f.arm_cm': 'Arm', 'f.thigh_cm': 'Thigh',

  'photos.gallery': 'Gallery', 'photos.compare': 'Compare', 'photos.add': 'Add photo', 'photos.all': 'All',
  'photos.empty': 'No photos yet. Upload a front, side and back photo so you can compare them.',
  'photos.type': 'Photo type', 'photos.picture': 'Picture', 'photos.choose': 'Take or choose photo',
  'photos.hint': 'The photo is shrunk before uploading to save data and space. Only you can see it.',
  'photos.uploading': 'Uploading…', 'photos.confirmDelete': 'Delete this photo?',
  'photos.kind.front': 'Front', 'photos.kind.side': 'Side', 'photos.kind.back': 'Back',

  'cmp.help': 'Pick the photo type and tap two days on the calendar: A and B.', 'cmp.choose': 'Pick',
  'cmp.pickBoth': 'Pick two dates to compare them.', 'cmp.noPhoto': 'No photo of this type that day',
  'cmp.before': 'Before', 'cmp.after': 'After', 'cmp.days': '{n} days between the two dates', 'cmp.differences': 'Differences',
  'cmp.noData': 'No weigh-ins or measurements logged near those dates.',

  'food.day': 'Diary', 'food.recipes': 'Recipes', 'food.protein': 'Protein', 'food.carbs': 'Carbs', 'food.fat': 'Fat',
  'food.add': 'Add meal', 'food.empty': 'No meals logged for this day yet.',
  'food.type.breakfast': 'Breakfast', 'food.type.lunch': 'Lunch', 'food.type.dinner': 'Dinner', 'food.type.snack': 'Snack', 'food.type.other': 'Other',
  'food.myRecipes': 'My recipes', 'food.newMeal': 'New meal', 'food.noRecipes': 'You have no saved recipes yet.',
  'food.servings': 'Servings', 'food.addShort': 'Add', 'food.newRecipe': 'New recipe', 'food.editRecipe': 'Edit recipe',
  'food.recipeName': 'Recipe name', 'food.mealName': 'Name (optional)', 'food.namePh': 'Chicken and rice',
  'food.noItems': 'Add ingredients with the search or by hand.', 'food.searchPh': 'Search food (rice, chicken…)',
  'food.search': 'Search', 'food.searching': 'Searching Open Food Facts…', 'food.noResults': 'No results. Try another word or add it by hand.',
  'food.searchFailed': 'Could not reach Open Food Facts. Check your connection or add the food by hand.',
  'food.manual': '+ Add an ingredient by hand', 'food.hideManual': 'Hide', 'food.ingName': 'Name', 'food.grams': 'Grams',
  'food.addIngredient': 'Add ingredient', 'food.saveAsRecipe': 'Also save as a recipe', 'food.addToDay': 'Add to day',
  'food.needIng': 'Enter at least a name and kcal per 100 g.', 'food.needItems': 'Add at least one ingredient.', 'food.needName': 'Give the recipe a name.',

  'sport.day': 'Diary', 'sport.routines': 'Routines', 'sport.todayIs': 'Today:', 'sport.add': 'Log workout', 'sport.edit': 'Edit workout',
  'sport.empty': 'No workouts this day.',
  'sport.type.gym': 'Gym', 'sport.type.padel': 'Padel', 'sport.type.walk': 'Walk', 'sport.type.other': 'Other',
  'sport.fromRoutine': 'Use a routine', 'sport.noRoutine': 'No routine (blank)', 'sport.nameOpt': 'Name (optional)',
  'sport.duration': 'Duration (min)', 'sport.notes': 'Notes', 'sport.exercise': 'Exercise', 'sport.exercisePh': 'Bench press',
  'sport.reps': 'Reps', 'sport.addSet': 'Set', 'sport.addExercise': 'Add exercise',
  'profile.link': 'My profile and kcal target', 'profile.linkHelp': 'Work out your basal metabolism and how much to eat',
  'profile.title': 'My profile', 'profile.back': 'Settings', 'profile.intro': 'Tell us where you start from and we will estimate how many kcal you burn and how many to eat for your goal.',
  'profile.sex': 'Sex', 'profile.male': 'Male', 'profile.female': 'Female', 'profile.birth': 'Date of birth', 'profile.height': 'Height (cm)',
  'profile.weight': 'Starting weight (kg)', 'profile.weightUsed': 'We use your latest recorded weight: {kg} kg ({date}). The starting weight only matters until you record one.',
  'profile.activity': 'Daily activity (sport included)',
  'profile.act.sedentary': 'Sedentary: almost no exercise', 'profile.act.light': 'Light: 1-3 days of exercise',
  'profile.act.moderate': 'Moderate: 3-5 days of exercise', 'profile.act.high': 'High: 6-7 days of exercise',
  'profile.act.athlete': 'Very high: hard training or physical job',
  'profile.goal': 'Goal', 'profile.goal.lose': 'Lose weight', 'profile.goal.maintain': 'Maintain', 'profile.goal.gain': 'Gain weight',
  'profile.pace': 'Pace', 'profile.pace.0.25': 'Gentle · 0.25 kg/wk', 'profile.pace.0.5': 'Moderate · 0.5 kg/wk', 'profile.pace.0.75': 'Fast · 0.75 kg/wk',
  'profile.goalWeight': 'Goal weight (kg, optional)', 'profile.save': 'Save profile', 'profile.saved': 'Profile saved',
  'profile.needData': 'Fill in sex, date of birth, height and weight to see your estimate.', 'profile.needSaveFirst': 'Sex, date of birth, height or weight is missing.',
  'profile.result': 'Your estimate', 'profile.target': 'Daily target', 'profile.bmr': 'Basal metabolism', 'profile.bmrHelp': 'what you burn at rest',
  'profile.tdee': 'Maintenance', 'profile.tdeeHelp': 'what you burn per day with your activity', 'profile.adjust': 'Daily adjustment',
  'profile.scaleBmr': 'Your scale estimates a basal rate of {n} kcal (for reference).', 'profile.macros': 'Suggested split', 'profile.bmi': 'BMI',
  'profile.eta': 'To reach {kg} kg at this pace: about {n} weeks (around {date}).',
  'profile.w.minor': 'Under 18 we do not suggest a deficit or surplus: we only show maintenance. Talk to your doctor or a dietitian.',
  'profile.w.underweight': 'Your BMI is low, so we do not suggest losing weight: we show maintenance. Please consult a professional.',
  'profile.w.floor': 'We limited the deficit so you do not go below a reasonable minimum of kcal. With your profile, losing faster is not recommended.',
  'profile.w.fast': 'That pace is over 1 % of your body weight per week; it is demanding and hard to keep up. A moderate pace usually works better.',
  'profile.w.goalDirection': 'Your goal weight does not match the chosen goal, so we do not estimate a timeline.',
  'profile.disclaimer': 'Rough estimate using the Mifflin-St Jeor formula and the 7,700 kcal per kg rule. Every body responds differently: adjust as your weight evolves. It does not replace advice from a doctor or dietitian, especially with pregnancy, breastfeeding or medical conditions.',
  'food.goal': 'Target', 'food.left': '{n} kcal left', 'food.over': '{n} kcal over', 'food.setGoal': 'Work out your kcal target',
  'sport.unit': 'Measure in', 'sport.unitKg': 'Kilos (kg)', 'sport.unitSec': 'Seconds', 'sport.sec': 'Sec',
  'sport.saveAsRoutine': 'Also save as a routine', 'sport.saveAsRoutineHint': 'If you already have a routine with that name, it is updated with these exercises.',
  'sport.routineNameReq': 'Give the routine a name', 'sport.routineNeedsEx': 'Add at least one exercise to save the routine', 'sport.savedWithRoutine': 'Workout and routine saved',
  'sport.newRoutine': 'New routine', 'sport.editRoutine': 'Edit routine', 'sport.noRoutines': 'Create your routines (e.g. "Chest and triceps") and use them every time you train.',
  'sport.noExercises': 'No exercises', 'sport.routineName': 'Routine name', 'sport.routinePh': 'Chest and triceps',
  'sport.weekday': 'Day of the week', 'sport.anyDay': 'No fixed day',

  'settings.language': 'Language', 'settings.theme': 'Appearance', 'settings.theme.auto': 'Automatic', 'settings.theme.light': 'Light', 'settings.theme.dark': 'Dark',
  'settings.install': 'Install on your phone', 'settings.installHelp': 'Add Evolucionapp to your home screen like any other app.',
  'settings.installBtn': 'Install', 'settings.installManual': 'In Chrome: menu ⋮ → "Install app" or "Add to home screen".',
  'settings.account': 'Account', 'settings.logout': 'Sign out',
};

export const DICT = { es, en };
let lang = 'es';
try {
  const saved = localStorage.getItem('lang');
  if (saved === 'es' || saved === 'en') lang = saved; // por defecto, español
} catch { /* sin almacenamiento: español */ }

const listeners = [];
export const getLang = () => lang;
export const locale = () => (lang === 'en' ? 'en-GB' : 'es-ES');
export const onLangChange = (fn) => listeners.push(fn);
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  try { localStorage.setItem('lang', lang); } catch { /* sin almacenamiento */ }
  document.documentElement.lang = lang;
  listeners.forEach((f) => f(lang));
}

export function t(key, vars) {
  let s = DICT[lang][key] ?? DICT.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
