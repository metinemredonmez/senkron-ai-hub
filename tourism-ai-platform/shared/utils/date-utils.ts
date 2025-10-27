export const formatDate = (date: Date | string, locale = "en-GB"): string => {
  const d = new Date(date);
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export const daysBetween = (start: Date, end: Date): number => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};