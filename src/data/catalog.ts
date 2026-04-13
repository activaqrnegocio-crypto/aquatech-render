export interface Product {
  id: number;
  name: string;
  code: string;
  category: 'Hidromasajes' | 'Turcos' | 'Saunas' | 'Piletas' | 'Tuberías' | 'Agua Potable' | 'Riego' | 'Accesorios';
  price: number;
  promoPrice?: number;
  img: string;
  tags?: string[];
}

export const catalogData: Product[] = [
  // HIDROMASAJES
  {
    id: 1,
    name: "HIDROMASAJE DUO PREMIUM",
    code: "AQ-HID-DUO",
    category: 'Hidromasajes',
    price: 2450.00,
    promoPrice: 2190.00,
    img: "https://cesarweb.b-cdn.net/Hidromasaje-Aquatech/model-duo.webp",
    tags: ['BEST SELLER', 'IBAX TECH']
  },
  {
    id: 2,
    name: "HIDROMASAJE MERENGUE SOCIAL",
    code: "AQ-HID-MER",
    category: 'Hidromasajes',
    price: 3120.00,
    img: "https://cesarweb.b-cdn.net/Hidromasaje-Aquatech/model-merengue.webp",
    tags: ['NEW']
  },
  {
    id: 3,
    name: "RELAX ELITE RECTANGULAR",
    code: "AQ-HID-REL",
    category: 'Hidromasajes',
    price: 1890.00,
    promoPrice: 1750.00,
    img: "https://cesarweb.b-cdn.net/Hidromasaje-Aquatech/model-relax.webp"
  },
  {
    id: 4,
    name: "SWIM SPA PRO FLOW",
    code: "AQ-HID-SWI",
    category: 'Hidromasajes',
    price: 8400.00,
    img: "https://cesarweb.b-cdn.net/Hidromasaje-Aquatech/model-swim.webp",
    tags: ['EXCLUSIVE']
  },
  {
    id: 5,
    name: "SPA EXTERIOR TITANIUM",
    code: "AQ-HID-SPA-T",
    category: 'Hidromasajes',
    price: 5900.00,
    img: "https://cesarweb.b-cdn.net/Hidromasaje-Aquatech/cat-spas.webp"
  },
  {
    id: 6,
    name: "JACUZZI ESQUINERO JADE",
    code: "AQ-HID-JAD",
    category: 'Hidromasajes',
    price: 1650.00,
    img: "https://cesarweb.b-cdn.net/Hidromasaje-Aquatech/cat-jacuzzis.webp"
  },
  {
    id: 7,
    name: "TINA ROMA MINIMALIST",
    code: "AQ-HID-ROM",
    category: 'Hidromasajes',
    price: 1100.00,
    img: "https://cesarweb.b-cdn.net/Hidromasaje-Aquatech/cat-tinas.webp"
  },
  {
    id: 8,
    name: "HIDROMASAJE ZEN CIRCULAR",
    code: "AQ-HID-ZEN",
    category: 'Hidromasajes',
    price: 2800.00,
    img: "https://cesarweb.b-cdn.net/Hidromasaje-Aquatech/hero-hidromasaje.webp"
  },
  {
    id: 9,
    name: "SPA FAMILIAR GRANDE",
    code: "AQ-HID-FAM",
    category: 'Hidromasajes',
    price: 4500.00,
    img: "https://cesarweb.b-cdn.net/home/hero-slider-3.webp"
  },
  {
    id: 10,
    name: "HIDROMASAJE EXECUTIVE",
    code: "AQ-HID-EXE",
    category: 'Hidromasajes',
    price: 3200.00,
    img: "https://cesarweb.b-cdn.net/Hidromasaje-Aquatech/model-duo.webp"
  },
  // TURCOS
  {
    id: 11,
    name: "GENERADOR VAPOR A GAS 20M³",
    code: "AQ-TUR-GAS20",
    category: 'Turcos',
    price: 1850.00,
    promoPrice: 1700.00,
    img: "https://cesarweb.b-cdn.net/home/hero-slider-3.webp",
    tags: ['COMERCIAL']
  },
  {
    id: 12,
    name: "BOMBA SILENCIOSA IBAX",
    code: "AQ-TUR-IBAX",
    category: 'Turcos',
    price: 450.00,
    img: "https://cesarweb.b-cdn.net/home/showroom_interior.webp",
    tags: ['IBAX TECH']
  },
  {
    id: 13,
    name: "TUBERÍA SCH80 ALTA TEMPERATURA",
    code: "AQ-TUR-SCH80",
    category: 'Turcos',
    price: 15.00,
    img: "https://cesarweb.b-cdn.net/home/detalle_ingenieria.webp"
  },
  {
    id: 14,
    name: "TERMOSTATO PTC PERILLA",
    code: "AQ-TUR-PTC",
    category: 'Turcos',
    price: 120.00,
    img: "https://cesarweb.b-cdn.net/home/equipo_trabajo.webp",
    tags: ['ACCESORIO']
  },
  {
    id: 15,
    name: "BOTÓN PULSADOR BALBOA 1144",
    code: "AQ-TUR-BAL1144",
    category: 'Turcos',
    price: 85.00,
    img: "https://cesarweb.b-cdn.net/home/showroom_interior.webp"
  },
  {
    id: 16,
    name: "BASE DE DUCHA ACRÍLICA",
    code: "AQ-TUR-ACR",
    category: 'Turcos',
    price: 250.00,
    img: "https://cesarweb.b-cdn.net/home/matriz_frente.webp",
    tags: ['NUEVO']
  },
  // SAUNAS
  {
    id: 17,
    name: "GENERADOR ELÉCTRICO EMAUX 9KW",
    code: "AQ-SAU-EM9",
    category: 'Saunas',
    price: 950.00,
    promoPrice: 880.00,
    img: "https://cesarweb.b-cdn.net/home/hero-slider-3.webp",
    tags: ['BEST SELLER', 'MADERA']
  },
  {
    id: 18,
    name: "SISTEMA CALEFACCIÓN A GAS 20M³",
    code: "AQ-SAU-GS20",
    category: 'Saunas',
    price: 1800.00,
    img: "https://cesarweb.b-cdn.net/home/showroom_interior.webp",
    tags: ['COMERCIAL']
  },
  {
    id: 19,
    name: "CONTROLADOR DIGITAL EMAUX",
    code: "AQ-SAU-CTD",
    category: 'Saunas',
    price: 210.00,
    img: "https://cesarweb.b-cdn.net/home/detalle_ingenieria.webp"
  },
  {
    id: 20,
    name: "TERMOSTATO PTC PRECISIÓN",
    code: "AQ-SAU-PTC",
    category: 'Saunas',
    price: 135.00,
    img: "https://cesarweb.b-cdn.net/home/equipo_trabajo.webp"
  },
  {
    id: 21,
    name: "KIT PIEDRAS VOLCÁNICAS 20KG",
    code: "AQ-SAU-PD20",
    category: 'Saunas',
    price: 85.00,
    img: "https://cesarweb.b-cdn.net/home/matriz_frente.webp",
    tags: ['ACCESORIO']
  },
  {
    id: 22,
    name: "SET TERMÓMETRO / HIGRÓMETRO",
    code: "AQ-SAU-THM",
    category: 'Saunas',
    price: 45.00,
    img: "https://cesarweb.b-cdn.net/home/hero-slider-2.webp",
    tags: ['ACCESORIO']
  },
  // PILETAS Y PISCINAS
  {
    id: 23,
    name: "BOMBA DE CALOR INVERTER IXR26",
    code: "AQ-PIL-IXR26",
    category: 'Piletas',
    price: 3800.00,
    promoPrice: 3500.00,
    img: "https://cesarweb.b-cdn.net/home/hero-slider-3.webp",
    tags: ['BEST SELLER', 'EMAUX']
  },
  {
    id: 24,
    name: "KIT NADO CONTRACORRIENTE A0509",
    code: "AQ-PIL-NAD",
    category: 'Piletas',
    price: 1950.00,
    img: "https://cesarweb.b-cdn.net/home/detalle_ingenieria.webp",
    tags: ['ENTRENAMIENTO']
  },
  {
    id: 25,
    name: "BOMBA EMAUX SPH075 (3/4 HP)",
    code: "AQ-PIL-SPH",
    category: 'Piletas',
    price: 320.00,
    img: "https://cesarweb.b-cdn.net/home/equipo_trabajo.webp"
  },
  {
    id: 26,
    name: "KIT DE FILTRACIÓN A0154",
    code: "AQ-PIL-FIL",
    category: 'Piletas',
    price: 450.00,
    img: "https://cesarweb.b-cdn.net/home/matriz_frente.webp"
  },
  {
    id: 27,
    name: "BOMBA MONOFÁSICA A0165",
    code: "AQ-PIL-A0165",
    category: 'Piletas',
    price: 280.00,
    img: "https://cesarweb.b-cdn.net/home/showroom_interior.webp"
  },
  {
    id: 28,
    name: "FARO LED SUBACUÁTICO CP-100",
    code: "AQ-PIL-LED",
    category: 'Piletas',
    price: 145.00,
    img: "https://cesarweb.b-cdn.net/home/locales-lifestyle.webp",
    tags: ['ILUMINACIÓN RGB']
  },
  // TUBERÍAS Y CONDUCCIÓN (PRODUCTOS Y SERVICIOS)
  {
    id: 29,
    name: "TUBO RIV PVC SCH40 1-1/2\"",
    code: "AQ-TUB-SCH40",
    category: 'Tuberías',
    price: 45.00,
    img: "https://cesarweb.b-cdn.net/home/detalle_ingenieria.webp",
    tags: ['ALTA PRESIÓN 330 PSI']
  },
  {
    id: 30,
    name: "TUBO RIV PRESIÓN E/C 90MM",
    code: "AQ-TUB-PEAD",
    category: 'Tuberías',
    price: 85.00,
    img: "https://cesarweb.b-cdn.net/home/equipo_trabajo.webp",
    tags: ['PEAD (0.80 MPA)']
  },
  {
    id: 31,
    name: "VÁLVULA REGULADORA SENNINGER",
    code: "AQ-TUB-SEN01",
    category: 'Tuberías',
    price: 120.00,
    img: "https://cesarweb.b-cdn.net/home/matriz_frente.webp",
    tags: ['RIEGO PROFESIONAL']
  },
  {
    id: 32,
    name: "CODO PEGABLE 63MM X 90°",
    code: "AQ-TUB-COD63",
    category: 'Tuberías',
    price: 4.50,
    img: "https://cesarweb.b-cdn.net/home/showroom_interior.webp",
    tags: ['MARCA ERA/GOLD']
  },
  {
    id: 33,
    name: "CONTROLADOR HUNTER X-CORE",
    code: "AQ-TUB-HUN",
    category: 'Tuberías',
    price: 350.00,
    img: "https://cesarweb.b-cdn.net/home/locales-lifestyle.webp",
    tags: ['AUTOMATIZACIÓN']
  },
  {
    id: 34,
    name: "TANQUE HIDRONEUMÁTICO",
    code: "AQ-TUB-HIDRO",
    category: 'Tuberías',
    price: 890.00,
    img: "https://cesarweb.b-cdn.net/home/hero-slider-3.webp",
    tags: ['PRESIÓN CONSTANTE']
  },
  // AGUA POTABLE Y PURIFICACIÓN
  {
    id: 35,
    name: "PURIFICADOR ÓSMOSIS INVERSA EVANS",
    code: "AQ-AGU-RO",
    category: 'Agua Potable',
    price: 680.00,
    promoPrice: 590.00,
    img: "https://cesarweb.b-cdn.net/home/hero-slider-3.webp",
    tags: ['PURIFICACIÓN 99%', 'CON BOMBA']
  },
  {
    id: 36,
    name: "SISTEMA DUAL ANTISARRO",
    code: "AQ-AGU-DUAL",
    category: 'Agua Potable',
    price: 85.00,
    img: "https://cesarweb.b-cdn.net/home/showroom_interior.webp",
    tags: ['TINACOS/CISTERNAS']
  },
  {
    id: 37,
    name: "GENERADOR DE OZONO AQUATECH",
    code: "AQ-AGU-OZO",
    category: 'Agua Potable',
    price: 320.00,
    img: "https://cesarweb.b-cdn.net/home/detalle_ingenieria.webp",
    tags: ['OXIDANTE POTENTE']
  },
  {
    id: 38,
    name: "LÁMPARA ULTRAVIOLETA (UV) EVANS",
    code: "AQ-AGU-UV",
    category: 'Agua Potable',
    price: 245.00,
    img: "https://cesarweb.b-cdn.net/home/equipo_trabajo.webp",
    tags: ['DESINFECCIÓN ADN']
  },
  {
    id: 39,
    name: "FILTRO EVANS ZEOLITA 0948",
    code: "AQ-AGU-ZEO",
    category: 'Agua Potable',
    price: 490.00,
    img: "https://cesarweb.b-cdn.net/home/matriz_frente.webp",
    tags: ['SEDIMENTOS']
  },
  {
    id: 40,
    name: "CARTUCHO PP SERIE PP-10",
    code: "AQ-AGU-PP10",
    category: 'Agua Potable',
    price: 18.00,
    img: "https://cesarweb.b-cdn.net/home/locales-lifestyle.webp",
    tags: ['REPUESTO']
  }
];
