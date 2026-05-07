function addLog(message) {
    const stamp = new Date().toLocaleString();
    const text = (typeof message === 'string') ? message : JSON.stringify(message);
    const logEl = document.getElementById('log');
    logEl.value = stamp + ': ' + text + '\r\n' + logEl.value;
}

function logStep(title, info) {
    info = info || {};
    const lines = ['▶ ' + title];
    if (info.method && info.url) lines.push('  → ' + info.method + ' ' + info.url);
    if (info.body !== undefined) lines.push('  → Body: ' + JSON.stringify(info.body));
    if (info.response !== undefined) lines.push('  ← Response: ' + JSON.stringify(info.response));
    if (info.ok) lines.push('  ✓ ' + info.ok);
    if (info.skip) lines.push('  ↪ ' + info.skip);
    if (info.error) lines.push('  ✗ ' + info.error);
    addLog(lines.join('\n'));
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
    document.getElementById('errorAlert').textContent = message;
    document.getElementById('errorAlert').style.display = '';
}

function showSuccess(message) {
    document.getElementById('errorAlert').style.display = 'none';
    document.getElementById('errorAlert').textContent = '';
    document.getElementById('successAlert').textContent = message;
    document.getElementById('successAlert').style.display = '';
}

// 警告文字 single source of truth（UI 與 log 共用，避免規則散落）
function getOverrideWarningText(customName) {
    return customName
        ? '已覆寫 Steam 結果，自動更新會固定使用「' + customName + '」'
        : '';
}

function getTemplateWarningText(template) {
    return (template && !template.includes('{game}'))
        ? 'Template 缺少 {game} 佔位符，遊戲名稱不會被替換'
        : '';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addLog, logStep, hideAllAlerts, showError, showSuccess,
        getOverrideWarningText, getTemplateWarningText
    };
}
