const Config = {
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'),
  SHEET_TAXDATA: PropertiesService.getScriptProperties().getProperty('SHEET_TAXDATA') || 'TaxData',
  SHEET_APPROVE_USERS: PropertiesService.getScriptProperties().getProperty('SHEET_APPROVE_USERS') || 'Approve_users',
  SHEET_USERS_PROFILE: PropertiesService.getScriptProperties().getProperty('SHEET_USERS_PROFILE') || 'users_profile',
  DRIVE_FOLDER_ID_BILLS: PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID_BILLS'),
  GEMINI_API_KEY: PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'),
  GEMINI_MODEL: PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || 'gemini-2.5-flash',
  EMAIL_BACKUP_RECIPIENT: PropertiesService.getScriptProperties().getProperty('EMAIL_BACKUP_RECIPIENT'),
  DAYS_TO_KEEP: parseInt(PropertiesService.getScriptProperties().getProperty('DAYS_TO_KEEP')) || 14
};
