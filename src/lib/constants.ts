export const PROJECT_TYPES: Record<string, string> = {
  'INSTALLATION': 'Instalación Nueva',
  'MAINTENANCE': 'Mantenimiento',
  'REPAIR': 'Reparación',
  'OTHER': 'Otro',
  'PISCINA': 'Piscina',
  'JACUZZI': 'Jacuzzi',
  'BOMBAS': 'Sistema de Bombeo',
  'TRATAMIENTO': 'Tratamiento de Agua',
  'RIEGO': 'Sistema de Riego',
  'CALENTAMIENTO': 'Calentamiento',
  'CONTRA_INCENDIOS': 'Contra Incendios',
  'MANTENIMIENTO': 'Mantenimiento General',
  'OTRO': 'Otros'
}

export const PROJECT_CATEGORIES: Record<string, string> = {
  'PISCINA': 'Piscina',
  'JACUZZI': 'Jacuzzi',
  'BOMBAS': 'Sistema de Bombeo',
  'TRATAMIENTO': 'Tratamiento de Agua',
  'RIEGO': 'Sistema de Riego',
  'CALENTAMIENTO': 'Calentamiento',
  'CONTRA_INCENDIOS': 'Contra Incendios',
  'MANTENIMIENTO': 'Mantenimiento General',
  'OTRO': 'Otros'
}

export const translateType = (type?: string | null) => {
  if (!type) return 'N/A'
  return PROJECT_TYPES[type.toUpperCase()] || type
}

export const translateCategory = (cat?: string | null) => {
  if (!cat) return 'N/A'
  return PROJECT_CATEGORIES[cat.toUpperCase()] || cat
}
