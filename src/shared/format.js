/* Number and money formatting, one way. */
export const money = (n) => `$${Number(n || 0).toLocaleString()}`;
export const money2 = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const num = (n) => Number(n || 0).toLocaleString();
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
