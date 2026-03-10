// ─── Variant Group Libraries ────────────────────────────────────────
// Curated color (Pantone fashion), material, and size-run data
// for the Add Variant Group form.

// ─── PANTONE FASHION COLORS ─────────────────────────────────────────
export interface PantoneColor {
    name: string;
    hex: string;
    pantone?: string;
    category: 'Neutrals' | 'Browns' | 'Reds' | 'Blues' | 'Greens' | 'Pinks & Purples' | 'Yellows & Oranges' | 'Greys';
}

export const PANTONE_COLORS: PantoneColor[] = [
    // ── Neutrals ──
    { name: 'Black', hex: '#000000', pantone: '19-0303 TCX', category: 'Neutrals' },
    { name: 'Jet Black', hex: '#0A0A0A', category: 'Neutrals' },
    { name: 'Brilliant White', hex: '#FFFFFF', pantone: '11-4001 TCX', category: 'Neutrals' },
    { name: 'Off White', hex: '#FAF9F6', category: 'Neutrals' },
    { name: 'Ivory', hex: '#FFFFF0', category: 'Neutrals' },
    { name: 'Cream', hex: '#FFFDD0', category: 'Neutrals' },
    { name: 'Almond Milk', hex: '#EFDECD', pantone: '12-4301 TCX', category: 'Neutrals' },
    { name: 'Antique White', hex: '#FAEBD7', pantone: '11-0105 TCX', category: 'Neutrals' },
    { name: 'Sand', hex: '#C2B280', category: 'Neutrals' },
    { name: 'Ecru', hex: '#C8AD7F', category: 'Neutrals' },
    { name: 'Bone', hex: '#E3DAC9', category: 'Neutrals' },

    // ── Browns ──
    { name: 'Mocha Mousse', hex: '#A47864', pantone: '17-1230 TCX', category: 'Browns' },
    { name: 'Camel', hex: '#C19A6B', category: 'Browns' },
    { name: 'Tan', hex: '#D2B48C', category: 'Browns' },
    { name: 'Cognac', hex: '#9A463D', category: 'Browns' },
    { name: 'Chocolate', hex: '#3C1321', pantone: '19-1317 TCX', category: 'Browns' },
    { name: 'Espresso', hex: '#3C2415', category: 'Browns' },
    { name: 'Hot Chocolate', hex: '#4E312D', pantone: '19-1325 TCX', category: 'Browns' },
    { name: 'Chestnut', hex: '#954535', category: 'Browns' },
    { name: 'Bronze Brown', hex: '#804A00', pantone: '18-0937 TCX', category: 'Browns' },
    { name: 'Tobacco', hex: '#71532F', category: 'Browns' },
    { name: 'Taupe', hex: '#483C32', category: 'Browns' },
    { name: 'Chutney', hex: '#B5651D', pantone: '18-1433 TCX', category: 'Browns' },

    // ── Reds ──
    { name: 'Scarlet', hex: '#FF2400', category: 'Reds' },
    { name: 'Poppy Red', hex: '#E35335', pantone: '17-1664 TCX', category: 'Reds' },
    { name: 'Crimson', hex: '#DC143C', category: 'Reds' },
    { name: 'Burgundy', hex: '#800020', category: 'Reds' },
    { name: 'Wine', hex: '#722F37', category: 'Reds' },
    { name: 'Windsor Wine', hex: '#643A48', pantone: '19-1528 TCX', category: 'Reds' },
    { name: 'Cherry', hex: '#DE3163', category: 'Reds' },
    { name: 'Red Orange', hex: '#FF4500', pantone: '17-1464 TCX', category: 'Reds' },
    { name: 'Brick Red', hex: '#CB4154', category: 'Reds' },
    { name: 'Oxblood', hex: '#4A0000', category: 'Reds' },

    // ── Blues ──
    { name: 'Navy', hex: '#000080', category: 'Blues' },
    { name: 'Royal Blue', hex: '#4169E1', category: 'Blues' },
    { name: 'Cobalt', hex: '#0047AB', category: 'Blues' },
    { name: 'Strong Blue', hex: '#1560BD', pantone: '18-4051 TCX', category: 'Blues' },
    { name: 'Chambray Blue', hex: '#5A86AD', pantone: '15-4030 TCX', category: 'Blues' },
    { name: 'Powder Blue', hex: '#B0E0E6', category: 'Blues' },
    { name: 'Horizon Blue', hex: '#448EE4', pantone: '16-4427 TCX', category: 'Blues' },
    { name: 'Airy Blue', hex: '#92B6D5', pantone: '14-4122 TCX', category: 'Blues' },
    { name: 'Denim', hex: '#1560BD', category: 'Blues' },
    { name: 'Teal', hex: '#008080', category: 'Blues' },
    { name: 'Eclipse', hex: '#343148', pantone: '19-3810 TCX', category: 'Blues' },

    // ── Greens ──
    { name: 'Emerald', hex: '#50C878', category: 'Greens' },
    { name: 'Forest Green', hex: '#228B22', category: 'Greens' },
    { name: 'Olive', hex: '#808000', category: 'Greens' },
    { name: 'Sage', hex: '#BCB88A', category: 'Greens' },
    { name: 'Mint', hex: '#98FF98', category: 'Greens' },
    { name: 'Viridian Green', hex: '#009B7D', pantone: '17-5126 TCX', category: 'Greens' },
    { name: 'Khaki', hex: '#C3B091', category: 'Greens' },
    { name: 'Army Green', hex: '#4B5320', category: 'Greens' },
    { name: 'Bistro Green', hex: '#3E5641', pantone: '19-5408 TCX', category: 'Greens' },

    // ── Pinks & Purples ──
    { name: 'Blush', hex: '#DE5D83', category: 'Pinks & Purples' },
    { name: 'Dusty Rose', hex: '#DCAE96', category: 'Pinks & Purples' },
    { name: 'Rose', hex: '#FF007F', category: 'Pinks & Purples' },
    { name: 'Peach Fuzz', hex: '#FFBE98', pantone: '13-1023 TCX', category: 'Pinks & Purples' },
    { name: 'Lilac', hex: '#C8A2C8', pantone: '14-3812 TCX', category: 'Pinks & Purples' },
    { name: 'Plum', hex: '#8E4585', category: 'Pinks & Purples' },
    { name: 'Mauve', hex: '#E0B0FF', category: 'Pinks & Purples' },
    { name: 'Italian Plum', hex: '#4B3B4F', pantone: '19-2514 TCX', category: 'Pinks & Purples' },
    { name: 'Fuchsia', hex: '#FF00FF', category: 'Pinks & Purples' },
    { name: 'Hibiscus', hex: '#B6316C', pantone: '18-1762 TCX', category: 'Pinks & Purples' },

    // ── Yellows & Oranges ──
    { name: 'Gold', hex: '#CFB53B', category: 'Yellows & Oranges' },
    { name: 'Mustard', hex: '#FFDB58', category: 'Yellows & Oranges' },
    { name: 'Amber', hex: '#FFBF00', category: 'Yellows & Oranges' },
    { name: 'Coral', hex: '#FF7F50', category: 'Yellows & Oranges' },
    { name: 'Peach', hex: '#FFDAB9', category: 'Yellows & Oranges' },
    { name: 'Orangeade', hex: '#E8793A', pantone: '17-1461 TCX', category: 'Yellows & Oranges' },
    { name: 'Sun Orange', hex: '#F58025', pantone: '16-1257 TCX', category: 'Yellows & Oranges' },
    { name: 'Lemon', hex: '#FFF44F', category: 'Yellows & Oranges' },

    // ── Greys ──
    { name: 'Charcoal', hex: '#36454F', category: 'Greys' },
    { name: 'Slate', hex: '#708090', category: 'Greys' },
    { name: 'Silver', hex: '#C0C0C0', category: 'Greys' },
    { name: 'Dove Grey', hex: '#B0AFA4', category: 'Greys' },
    { name: 'Gunmetal', hex: '#2C3539', category: 'Greys' },
    { name: 'Heather Grey', hex: '#B6B6B4', category: 'Greys' },
    { name: 'Ash', hex: '#B2BEB5', category: 'Greys' },
];

// ─── MATERIALS ──────────────────────────────────────────────────────
export interface MaterialOption {
    name: string;
    category: 'Leather' | 'Textiles' | 'Synthetics' | 'Exotic' | 'Others';
}

export const MATERIALS: MaterialOption[] = [
    // ── Leather ──
    { name: 'Full-grain Leather', category: 'Leather' },
    { name: 'Nappa Leather', category: 'Leather' },
    { name: 'Patent Leather', category: 'Leather' },
    { name: 'Saffiano Leather', category: 'Leather' },
    { name: 'Pebbled Leather', category: 'Leather' },
    { name: 'Calfskin Leather', category: 'Leather' },
    { name: 'Lambskin Leather', category: 'Leather' },
    { name: 'Suede', category: 'Leather' },
    { name: 'Nubuck', category: 'Leather' },
    { name: 'Vegan Leather', category: 'Leather' },

    // ── Textiles ──
    { name: 'Cotton', category: 'Textiles' },
    { name: 'Silk', category: 'Textiles' },
    { name: 'Cashmere', category: 'Textiles' },
    { name: 'Wool', category: 'Textiles' },
    { name: 'Merino Wool', category: 'Textiles' },
    { name: 'Linen', category: 'Textiles' },
    { name: 'Denim', category: 'Textiles' },
    { name: 'Tweed', category: 'Textiles' },
    { name: 'Velvet', category: 'Textiles' },
    { name: 'Satin', category: 'Textiles' },
    { name: 'Organza', category: 'Textiles' },
    { name: 'Tulle', category: 'Textiles' },
    { name: 'Chiffon', category: 'Textiles' },
    { name: 'Jersey', category: 'Textiles' },
    { name: 'Crepe', category: 'Textiles' },
    { name: 'Jacquard', category: 'Textiles' },
    { name: 'Twill', category: 'Textiles' },

    // ── Synthetics ──
    { name: 'Nylon', category: 'Synthetics' },
    { name: 'Polyester', category: 'Synthetics' },
    { name: 'Viscose', category: 'Synthetics' },
    { name: 'Lycra / Spandex', category: 'Synthetics' },
    { name: 'Neoprene', category: 'Synthetics' },
    { name: 'Acrylic', category: 'Synthetics' },
    { name: 'Modal', category: 'Synthetics' },
    { name: 'Tencel', category: 'Synthetics' },

    // ── Exotic ──
    { name: 'Python', category: 'Exotic' },
    { name: 'Crocodile', category: 'Exotic' },
    { name: 'Alligator', category: 'Exotic' },
    { name: 'Ostrich', category: 'Exotic' },
    { name: 'Shearling', category: 'Exotic' },
    { name: 'Pony Hair', category: 'Exotic' },

    // ── Others ──
    { name: 'Canvas', category: 'Others' },
    { name: 'Raffia', category: 'Others' },
    { name: 'Straw', category: 'Others' },
    { name: 'Rubber', category: 'Others' },
    { name: 'Metal', category: 'Others' },
    { name: 'Resin', category: 'Others' },
    { name: 'Cork', category: 'Others' },
    { name: 'Shell / Mother of Pearl', category: 'Others' },
];

// ─── SIZE RUN PRESETS ───────────────────────────────────────────────
// Based on Net-a-Porter, Ounass, Moda Operandi size charts
export interface SizePreset {
    label: string;
    sizes: string[];
    group: 'Clothing' | 'Shoes' | 'Denim' | 'Accessories';
}

export const SIZE_RUN_PRESETS: SizePreset[] = [
    // ── Clothing ──
    { label: 'Alpha (XXS–XXL)', sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'], group: 'Clothing' },
    { label: 'IT (36–48)', sizes: ['36', '38', '40', '42', '44', '46', '48'], group: 'Clothing' },
    { label: 'FR (34–46)', sizes: ['34', '36', '38', '40', '42', '44', '46'], group: 'Clothing' },
    { label: 'US (0–14)', sizes: ['0', '2', '4', '6', '8', '10', '12', '14'], group: 'Clothing' },
    { label: 'UK (4–18)', sizes: ['4', '6', '8', '10', '12', '14', '16', '18'], group: 'Clothing' },

    // ── Shoes ──
    { label: 'EU Women (35–41)', sizes: ['35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5', '41'], group: 'Shoes' },
    { label: 'EU Men (39–46)', sizes: ['39', '39.5', '40', '40.5', '41', '41.5', '42', '42.5', '43', '43.5', '44', '44.5', '45', '46'], group: 'Shoes' },
    { label: 'US Women (5–11)', sizes: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11'], group: 'Shoes' },
    { label: 'US Men (6–13)', sizes: ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13'], group: 'Shoes' },

    // ── Denim ──
    { label: 'Denim (24–34)', sizes: ['24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'], group: 'Denim' },

    // ── Accessories ──
    { label: 'Bags', sizes: ['Mini', 'Small', 'Medium', 'Large'], group: 'Accessories' },
    { label: 'Belts (70–110 cm)', sizes: ['70', '75', '80', '85', '90', '95', '100', '105', '110'], group: 'Accessories' },
    { label: 'Rings (US 4–12)', sizes: ['4', '5', '6', '7', '8', '9', '10', '11', '12'], group: 'Accessories' },
    { label: 'One Size', sizes: ['OS'], group: 'Accessories' },
];

// ─── CURRENCIES ─────────────────────────────────────────────────────
export interface Currency {
    code: string;
    symbol: string;
    name: string;
}

export const CURRENCIES: Currency[] = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
    { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'KRW', symbol: '₩', name: 'Korean Won' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
];

// Category helpers
export const COLOR_CATEGORIES = [...new Set(PANTONE_COLORS.map(c => c.category))] as const;
export const MATERIAL_CATEGORIES = [...new Set(MATERIALS.map(m => m.category))] as const;
export const SIZE_GROUPS = [...new Set(SIZE_RUN_PRESETS.map(s => s.group))] as const;
