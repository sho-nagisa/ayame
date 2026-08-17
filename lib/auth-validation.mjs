export function normalizeStudentName(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function validStudentName(name) {
  return name.length >= 2 && name.length <= 20 && /^[\p{L}\p{N} ._-]+$/u.test(name);
}

export function validPassword(value) {
  return typeof value === "string" && value.length >= 6 && value.length <= 72;
}
