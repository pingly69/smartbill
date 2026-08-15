function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('SmartBill')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    let result = null;
    
    if (action === 'analyze') {
      result = analyzeInvoice(payload.base64, payload.type);
    } else if (action === 'getApprovers') {
      result = getApproverList();
    } else if (action === 'getUserProfile') {
      result = getUserProfile(payload.lineUid);
    } else if (action === 'submit') {
      result = submitBill(payload.formData);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else {
      throw new Error("Unknown action: " + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    Logger.log("doPost Error: " + err.stack);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
