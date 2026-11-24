import { customAlphabet } from 'nanoid';

// Lowercase alphanumerics with a letter prefix, so IDs are always valid CSS selectors.
const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

export type IdPrefix = 'p' | 's' | 'e' | 'f' | 't';
export const newId = (prefix: IdPrefix): string => `${prefix}${nano()}`;
