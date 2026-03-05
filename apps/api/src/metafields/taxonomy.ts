/**
 * Shopify Standard Product Taxonomy
 * 
 * Provides a searchable list of Shopify product categories.
 * Based on Shopify's Standard Product Taxonomy (JSON format).
 * 
 * For v1: using a curated subset of common categories.
 * Full taxonomy can be imported from Shopify's GitHub repository.
 */

export interface TaxonomyCategory {
    id: string;
    fullName: string;
    level: number;
    parentId?: string;
}

// Curated subset of Shopify Standard Product Taxonomy
// Full list: https://github.com/Shopify/product-taxonomy
const TAXONOMY_DATA: TaxonomyCategory[] = [
    // Apparel & Accessories
    { id: 'aa-1', fullName: 'Apparel & Accessories', level: 0 },
    { id: 'aa-1-1', fullName: 'Apparel & Accessories > Clothing', level: 1, parentId: 'aa-1' },
    { id: 'aa-1-1-1', fullName: 'Apparel & Accessories > Clothing > Dresses', level: 2, parentId: 'aa-1-1' },
    { id: 'aa-1-1-2', fullName: 'Apparel & Accessories > Clothing > Tops', level: 2, parentId: 'aa-1-1' },
    { id: 'aa-1-1-2-1', fullName: 'Apparel & Accessories > Clothing > Tops > T-Shirts', level: 3, parentId: 'aa-1-1-2' },
    { id: 'aa-1-1-2-2', fullName: 'Apparel & Accessories > Clothing > Tops > Blouses', level: 3, parentId: 'aa-1-1-2' },
    { id: 'aa-1-1-2-3', fullName: 'Apparel & Accessories > Clothing > Tops > Crop Tops', level: 3, parentId: 'aa-1-1-2' },
    { id: 'aa-1-1-2-4', fullName: 'Apparel & Accessories > Clothing > Tops > Tank Tops', level: 3, parentId: 'aa-1-1-2' },
    { id: 'aa-1-1-3', fullName: 'Apparel & Accessories > Clothing > Bottoms', level: 2, parentId: 'aa-1-1' },
    { id: 'aa-1-1-3-1', fullName: 'Apparel & Accessories > Clothing > Bottoms > Pants', level: 3, parentId: 'aa-1-1-3' },
    { id: 'aa-1-1-3-2', fullName: 'Apparel & Accessories > Clothing > Bottoms > Shorts', level: 3, parentId: 'aa-1-1-3' },
    { id: 'aa-1-1-3-3', fullName: 'Apparel & Accessories > Clothing > Bottoms > Skirts', level: 3, parentId: 'aa-1-1-3' },
    { id: 'aa-1-1-3-4', fullName: 'Apparel & Accessories > Clothing > Bottoms > Jeans', level: 3, parentId: 'aa-1-1-3' },
    { id: 'aa-1-1-4', fullName: 'Apparel & Accessories > Clothing > Outerwear', level: 2, parentId: 'aa-1-1' },
    { id: 'aa-1-1-4-1', fullName: 'Apparel & Accessories > Clothing > Outerwear > Jackets', level: 3, parentId: 'aa-1-1-4' },
    { id: 'aa-1-1-4-2', fullName: 'Apparel & Accessories > Clothing > Outerwear > Coats', level: 3, parentId: 'aa-1-1-4' },
    { id: 'aa-1-1-4-3', fullName: 'Apparel & Accessories > Clothing > Outerwear > Blazers', level: 3, parentId: 'aa-1-1-4' },
    { id: 'aa-1-1-5', fullName: 'Apparel & Accessories > Clothing > Jumpsuits & Rompers', level: 2, parentId: 'aa-1-1' },
    { id: 'aa-1-1-6', fullName: 'Apparel & Accessories > Clothing > Swimwear', level: 2, parentId: 'aa-1-1' },
    { id: 'aa-1-1-7', fullName: 'Apparel & Accessories > Clothing > Activewear', level: 2, parentId: 'aa-1-1' },
    { id: 'aa-1-1-8', fullName: 'Apparel & Accessories > Clothing > Sleepwear', level: 2, parentId: 'aa-1-1' },
    { id: 'aa-1-1-9', fullName: 'Apparel & Accessories > Clothing > Suits & Sets', level: 2, parentId: 'aa-1-1' },
    // Specific dress types
    { id: 'aa-1-1-1-1', fullName: 'Apparel & Accessories > Clothing > Dresses > Mini Dress', level: 3, parentId: 'aa-1-1-1' },
    { id: 'aa-1-1-1-2', fullName: 'Apparel & Accessories > Clothing > Dresses > Midi Dress', level: 3, parentId: 'aa-1-1-1' },
    { id: 'aa-1-1-1-3', fullName: 'Apparel & Accessories > Clothing > Dresses > Maxi Dress', level: 3, parentId: 'aa-1-1-1' },
    { id: 'aa-1-1-1-4', fullName: 'Apparel & Accessories > Clothing > Dresses > Gown Dress', level: 3, parentId: 'aa-1-1-1' },
    { id: 'aa-1-1-1-5', fullName: 'Apparel & Accessories > Clothing > Dresses > Cocktail Dress', level: 3, parentId: 'aa-1-1-1' },
    // Accessories
    { id: 'aa-2', fullName: 'Apparel & Accessories > Accessories', level: 1, parentId: 'aa-1' },
    { id: 'aa-2-1', fullName: 'Apparel & Accessories > Accessories > Bags & Purses', level: 2, parentId: 'aa-2' },
    { id: 'aa-2-2', fullName: 'Apparel & Accessories > Accessories > Jewelry', level: 2, parentId: 'aa-2' },
    { id: 'aa-2-3', fullName: 'Apparel & Accessories > Accessories > Hats & Headwear', level: 2, parentId: 'aa-2' },
    { id: 'aa-2-4', fullName: 'Apparel & Accessories > Accessories > Scarves & Wraps', level: 2, parentId: 'aa-2' },
    { id: 'aa-2-5', fullName: 'Apparel & Accessories > Accessories > Belts', level: 2, parentId: 'aa-2' },
    { id: 'aa-2-6', fullName: 'Apparel & Accessories > Accessories > Sunglasses', level: 2, parentId: 'aa-2' },
    // Shoes
    { id: 'aa-3', fullName: 'Apparel & Accessories > Shoes', level: 1, parentId: 'aa-1' },
    { id: 'aa-3-1', fullName: 'Apparel & Accessories > Shoes > Heels', level: 2, parentId: 'aa-3' },
    { id: 'aa-3-2', fullName: 'Apparel & Accessories > Shoes > Boots', level: 2, parentId: 'aa-3' },
    { id: 'aa-3-3', fullName: 'Apparel & Accessories > Shoes > Sandals', level: 2, parentId: 'aa-3' },
    { id: 'aa-3-4', fullName: 'Apparel & Accessories > Shoes > Sneakers', level: 2, parentId: 'aa-3' },
    { id: 'aa-3-5', fullName: 'Apparel & Accessories > Shoes > Flats', level: 2, parentId: 'aa-3' },
    // Beauty & Personal Care
    { id: 'bp-1', fullName: 'Beauty & Personal Care', level: 0 },
    { id: 'bp-1-1', fullName: 'Beauty & Personal Care > Skincare', level: 1, parentId: 'bp-1' },
    { id: 'bp-1-2', fullName: 'Beauty & Personal Care > Makeup', level: 1, parentId: 'bp-1' },
    { id: 'bp-1-3', fullName: 'Beauty & Personal Care > Hair Care', level: 1, parentId: 'bp-1' },
    { id: 'bp-1-4', fullName: 'Beauty & Personal Care > Fragrance', level: 1, parentId: 'bp-1' },
    // Home & Living
    { id: 'hl-1', fullName: 'Home & Living', level: 0 },
    { id: 'hl-1-1', fullName: 'Home & Living > Home Decor', level: 1, parentId: 'hl-1' },
    { id: 'hl-1-2', fullName: 'Home & Living > Furniture', level: 1, parentId: 'hl-1' },
    { id: 'hl-1-3', fullName: 'Home & Living > Bedding', level: 1, parentId: 'hl-1' },
    { id: 'hl-1-4', fullName: 'Home & Living > Kitchen & Dining', level: 1, parentId: 'hl-1' },
];

let cachedCategories: TaxonomyCategory[] | null = null;

export function getTaxonomyCategories(): TaxonomyCategory[] {
    if (!cachedCategories) {
        cachedCategories = TAXONOMY_DATA;
    }
    return cachedCategories;
}

export function searchTaxonomy(query: string): TaxonomyCategory[] {
    const lower = query.toLowerCase().trim();
    if (!lower) return getTaxonomyCategories();

    return getTaxonomyCategories().filter(
        c => c.fullName.toLowerCase().includes(lower) || c.id.includes(lower),
    );
}

export function getCategoryById(id: string): TaxonomyCategory | undefined {
    return getTaxonomyCategories().find(c => c.id === id);
}
