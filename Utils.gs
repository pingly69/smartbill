/**
 * ฟังก์ชันช่วยเหลือต่างๆ (Helper)
 */

function formatDateToDDMMYYYY(isoDateString) {
  if (!isoDateString) return "";
  const date = new Date(isoDateString);
  if (isNaN(date.getTime())) return isoDateString;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseNumber(val) {
  if (val === undefined || val === null || val === "") return 0.0;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0.0 : parsed;
}
