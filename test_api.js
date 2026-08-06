const url = 'https://script.google.com/macros/s/AKfycbzgiozlTEfJcN9pSH9cYtIabYNy_J7DyjyE0P6tMB8rkki-7kPbslsFw2qHOB1G5BGIUg/exec';
const payload = { action: 'getPendingApprovals', payload: { approverName: 'พี่เสือ' } };

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify(payload)
})
.then(res => res.text())
.then(text => console.log('RESPONSE:', text))
.catch(err => console.error('ERROR:', err));
