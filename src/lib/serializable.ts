/**
 * Utility to convert complex objects (with Prisma Decimals and Dates)
 * into plain objects that can be passed to Client Components.
 */
export function deepSerialize<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  // Handle special types with toJSON (like Decimal and Date)
  if (typeof (obj as any).toJSON === 'function') {
    const json = (obj as any).toJSON();
    // Decimal returns a string, Date returns a string
    // In Prisma, we often want the number for Decimal if possible
    if (obj.constructor?.name === 'Decimal') return Number(json) as unknown as T;
    // For Date, we keep it as a string to avoid hydration mismatches
    return json as unknown as T;
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepSerialize(item)) as unknown as T;
  }

  // Handle Objects
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = deepSerialize((obj as any)[key]);
      }
    }
    return newObj as T;
  }

  return obj;
}
