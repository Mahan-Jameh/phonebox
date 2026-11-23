const message = document.querySelector('#status');
async function show(action) {
  try {
    const r = await chrome.runtime.sendMessage(action);
    message.textContent = r.error || (r.code ? `کد یک‌بارمصرف تبلت: ${r.code}` : 'اشتراک فعال نیست.');
  } catch { message.textContent = 'ارتباط با افزونه برقرار نشد.'; }
}
document.querySelector('#start').onclick = () => show('start');
document.querySelector('#stop').onclick = () => show('stop');
show('status');
