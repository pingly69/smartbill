const url = 'https://script.google.com/macros/s/AKfycbzgiozlTEfJcN9pSH9cYtIabYNy_J7DyjyE0P6tMB8rkki-7kPbslsFw2qHOB1G5BGIUg/exec';
const payload = { action: 'ping', payload: {} };

console.log("Fetching...");
const start = Date.now();
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify(payload)
})
.then(res => res.text())
.then(text => {
  console.log(`RESPONSE (${Date.now() - start}ms):`, text);
})
.catch(err => console.error('ERROR:', err));
