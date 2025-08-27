// Mock implementation for parse-duration
module.exports = function parseDuration(input) {
  if (typeof input !== 'string') return null;

  // Basic implementation for common cases
  const match = input.match(/(\d+)([a-z]+)/i);
  if (!match) return null;

  const [, value, unit] = match;
  const number = parseInt(value, 10);

  switch (unit.toLowerCase()) {
    case 's':
    case 'sec':
    case 'second':
    case 'seconds':
      return number * 1000;
    case 'm':
    case 'min':
    case 'minute':
    case 'minutes':
      return number * 60 * 1000;
    case 'h':
    case 'hr':
    case 'hour':
    case 'hours':
      return number * 60 * 60 * 1000;
    case 'd':
    case 'day':
    case 'days':
      return number * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
};
