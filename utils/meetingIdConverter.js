// utils/meetingIdConverter.js

/**
 * Converts a UUID to short format: aaaa-bbbb-cccc
 * @param {string} uuid - Full UUID (e.g., "2199d99d-ae59-4867-9bd9-9a172a29f6d4")
 * @returns {string} Short ID (e.g., "2199-d99d-ae59")
 */
export function uuidToShortId(uuid) {
  // Remove all dashes and take first 12 characters
  const cleaned = uuid.replace(/-/g, '');
  const short = cleaned.substring(0, 12);
  
  // Format as aaaa-bbbb-cccc
  return `${short.substring(0, 4)}-${short.substring(4, 8)}-${short.substring(8, 12)}`;
}

/**
 * Generates a random short meeting ID: aaaa-bbbb-cccc
 * @returns {string} Short meeting ID
 */
export function generateShortMeetingId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  
  const generateSegment = (length = 4) => {
    return Array.from({ length }, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  };
  
  return `${generateSegment()}-${generateSegment()}-${generateSegment()}`;
}

/**
 * Validates if a string matches the short ID format
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid format
 */
export function isValidShortId(id) {
  return /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(id);
}

/**
 * Stores mapping between short ID and full UUID
 * In production, this should be stored in a database
 */
const idMapping = new Map();

/**
 * Creates a short ID for a UUID and stores the mapping
 * @param {string} uuid - Full UUID from VideoSDK
 * @returns {string} Short meeting ID
 */
export function createShortIdMapping(uuid) {
  const shortId = uuidToShortId(uuid);
  idMapping.set(shortId, uuid);
  return shortId;
}

/**
 * Gets the full UUID from a short ID
 * @param {string} shortId - Short meeting ID
 * @returns {string|null} Full UUID or null if not found
 */
export function getFullUuidFromShortId(shortId) {
  return idMapping.get(shortId) || null;
}