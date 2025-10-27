export function maskValue(value?: string | null): string | null {
  if (!value) {
    return value ?? null;
  }
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export function redactObject<T extends Record<string, any>>(payload: T, keys: string[]): T {
  const clone: Record<string, any> = { ...payload };
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(clone, key) && clone[key]) {
      clone[key] = maskValue(String(clone[key]));
    }
  });
  return clone as T;
}
