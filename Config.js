const _props = PropertiesService.getScriptProperties().getProperties() || {};

const Config = {
  SPREADSHEET_ID: _props['SPREADSHEET_ID'],
  SPREADSHEET_ID_BACKUP: _props['SPREADSHEET_ID_BACKUP'],
  SHEET_TAXDATA: _props['SHEET_TAXDATA'] || 'TaxData',
  SHEET_APPROVE_USERS: _props['SHEET_APPROVE_USERS'] || 'Approve_users',
  SHEET_USERS_PROFILE: _props['SHEET_USERS_PROFILE'] || 'users_profile',
  DRIVE_FOLDER_ID_BILLS: _props['DRIVE_FOLDER_ID_BILLS'],
  GEMINI_API_KEY: _props['GEMINI_API_KEY'],
  GEMINI_MODEL: _props['GEMINI_MODEL'] || 'gemini-2.5-flash',
  EMAIL_BACKUP_RECIPIENT: _props['EMAIL_BACKUP_RECIPIENT'],
  DAYS_TO_KEEP: parseInt(_props['DAYS_TO_KEEP']) || 14
};

