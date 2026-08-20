export function parsePositiveAppearanceNumber(rawValue) {
  const text = String(rawValue ?? '').trim();
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function mergeAppearanceDraft(
  baseAppearance,
  numberValues,
  colorValues,
) {
  const appearance = { ...baseAppearance };
  const invalidNumberKeys = [];

  Object.entries(numberValues).forEach(([key, rawValue]) => {
    const value = parsePositiveAppearanceNumber(rawValue);
    if (value === null) invalidNumberKeys.push(key);
    else appearance[key] = value;
  });

  Object.entries(colorValues).forEach(([key, value]) => {
    appearance[key] = value;
  });

  return { appearance, invalidNumberKeys };
}

export function requireCompleteAppearanceDraft(
  baseAppearance,
  numberValues,
  colorValues,
) {
  const result = mergeAppearanceDraft(baseAppearance, numberValues, colorValues);
  if (result.invalidNumberKeys.length > 0) {
    throw new Error('Every font and circle size must be a positive number.');
  }
  return result.appearance;
}

export function createAnimationFrameScheduler(callback, requestFrame, cancelFrame) {
  let frame = null;
  return {
    schedule() {
      if (frame !== null) cancelFrame(frame);
      frame = requestFrame(() => {
        frame = null;
        callback();
      });
    },
    cancel() {
      if (frame === null) return;
      cancelFrame(frame);
      frame = null;
    },
  };
}
