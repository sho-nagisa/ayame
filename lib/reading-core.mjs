function normalizeReading(value) {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[ァ-ヶ]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60),
    );
}

function uniqueReadings(values) {
  return [...new Set(values.map(normalizeReading).filter(Boolean))];
}

function parseAcceptedReadings(value, fallback = []) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback;
    const readings = uniqueReadings(
      parsed.filter((item) => typeof item === "string"),
    );
    return readings.length ? readings : fallback;
  } catch {
    return fallback;
  }
}

function validateAcceptedReadings(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    return null;
  }
  const readings = uniqueReadings(
    value.filter((item) => typeof item === "string"),
  );
  if (
    readings.length < 1 ||
    readings.some(
      (reading) => reading.length > 40 || !/^[ぁ-ゖー]+$/.test(reading),
    )
  ) {
    return null;
  }
  return readings;
}

export { normalizeReading, parseAcceptedReadings, validateAcceptedReadings };
