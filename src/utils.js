function addLog(message) {
    var currentStamp = new Date().toLocaleString();
    console.log(currentStamp, message);
    var logEl = document.getElementById('log');
    logEl.value = currentStamp + ':' + JSON.stringify(message) + '\r\n' + logEl.value;
}

function hideAllAlerts() {
    document.getElementById('successAlert').style.display = 'none';
    document.getElementById('successAlert').textContent = '';
    document.getElementById('errorAlert').style.display = 'none';
    document.getElementById('errorAlert').textContent = '';
}

function showError(message) {
    document.getElementById('successAlert').style.display = 'none';
    document.getElementById('successAlert').textContent = '';
    document.getElementById('errorAlert').innerHTML = message;
    document.getElementById('errorAlert').style.display = '';
}

function showSuccess(message) {
    document.getElementById('errorAlert').style.display = 'none';
    document.getElementById('errorAlert').textContent = '';
    document.getElementById('successAlert').innerHTML = message;
    document.getElementById('successAlert').style.display = '';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { addLog, hideAllAlerts, showError, showSuccess };
}
