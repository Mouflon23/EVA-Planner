function normalizeClockLabel(hourText, minuteText) {
  return `${String(Number(hourText)).padStart(2, "0")}:${minuteText}`;
}

function parseSingleSlot(input, fallbackReservationUrl) {
  const trimmed = (input || "").trim();
  const match =
    /^([01]?\d|2[0-3])(?::|h)([0-5]\d)\s+(HP|HC)(?:\s+(https?:\/\/\S+))?$/i.exec(
      trimmed
    );
  if (!match) {
    return null;
  }

  const period = match[3].toUpperCase();
  const reservationUrl = match[4] || fallbackReservationUrl || null;
  return {
    timeLabel: normalizeClockLabel(match[1], match[2]),
    period,
    reservationUrl,
  };
}

function parseSlotsInput(input, fallbackReservationUrl) {
  const text = (input || "").trim();
  if (!text) {
    return { error: "Slots are required." };
  }

  const parts = text
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { error: "At least one slot is required." };
  }

  const slots = [];
  for (const part of parts) {
    const slot = parseSingleSlot(part, fallbackReservationUrl);
    if (!slot) {
      return {
        error:
          "Invalid slot format. Use `20h40 HP` or `20:40 HC` (optional URL after).",
      };
    }
    slots.push(slot);
  }

  return { slots };
}

function slotsToInput(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return "";
  }

  // Modal default text must stay <= TextInput max length.
  const maxLength = 900;
  const parts = [];
  let currentLength = 0;

  for (const slot of slots) {
    const base = `${slot.timeLabel} ${slot.period}`;
    const part = slot.reservationUrl ? `${base} ${slot.reservationUrl}` : base;
    const separator = parts.length === 0 ? "" : ", ";
    const additionLength = separator.length + part.length;
    if (currentLength + additionLength > maxLength) {
      break;
    }

    parts.push(part);
    currentLength += additionLength;
  }

  return parts.join(", ");
}

function slotsSummary(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return "-";
  }

  return slots
    .map((slot) => {
      const base = `${slot.timeLabel} ${slot.period}`;
      return base;
    })
    .join(", ");
}

module.exports = {
  parseSlotsInput,
  slotsToInput,
  slotsSummary,
};
