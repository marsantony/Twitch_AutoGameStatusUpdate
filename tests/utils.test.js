import { describe, it, expect, beforeEach } from 'vitest';
import { addLog, hideAllAlerts, showError, showSuccess } from '../src/utils.js';

function setupDOM() {
    document.body.innerHTML = `
        <textarea id="log"></textarea>
        <div id="successAlert" style="display:none;"></div>
        <div id="errorAlert" style="display:none;"></div>
    `;
}

describe('utils', () => {
    beforeEach(() => {
        setupDOM();
    });

    describe('addLog', () => {
        it('將訊息寫入 log textarea', () => {
            addLog('測試訊息');
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('測試訊息');
        });

        it('新訊息在前面（最新的在上面）', () => {
            addLog('第一則');
            addLog('第二則');
            var logEl = document.getElementById('log');
            var firstIndex = logEl.value.indexOf('第一則');
            var secondIndex = logEl.value.indexOf('第二則');
            expect(secondIndex).toBeLessThan(firstIndex);
        });

        it('包含時間戳記', () => {
            addLog('test');
            var logEl = document.getElementById('log');
            // 應包含日期格式的字串（至少有數字和冒號）
            expect(logEl.value).toMatch(/\d+.*:/);
        });
    });

    describe('hideAllAlerts', () => {
        it('隱藏所有 alert 並清空內容', () => {
            document.getElementById('successAlert').style.display = '';
            document.getElementById('successAlert').textContent = '成功';
            document.getElementById('errorAlert').style.display = '';
            document.getElementById('errorAlert').textContent = '錯誤';

            hideAllAlerts();

            expect(document.getElementById('successAlert').style.display).toBe('none');
            expect(document.getElementById('successAlert').textContent).toBe('');
            expect(document.getElementById('errorAlert').style.display).toBe('none');
            expect(document.getElementById('errorAlert').textContent).toBe('');
        });
    });

    describe('showError', () => {
        it('顯示錯誤訊息並隱藏成功訊息', () => {
            document.getElementById('successAlert').style.display = '';
            document.getElementById('successAlert').textContent = '之前的成功';

            showError('發生錯誤');

            expect(document.getElementById('errorAlert').textContent).toBe('發生錯誤');
            expect(document.getElementById('errorAlert').style.display).toBe('');
            expect(document.getElementById('successAlert').style.display).toBe('none');
            expect(document.getElementById('successAlert').textContent).toBe('');
        });
    });

    describe('showSuccess', () => {
        it('顯示成功訊息並隱藏錯誤訊息', () => {
            document.getElementById('errorAlert').style.display = '';
            document.getElementById('errorAlert').textContent = '之前的錯誤';

            showSuccess('操作成功');

            expect(document.getElementById('successAlert').textContent).toBe('操作成功');
            expect(document.getElementById('successAlert').style.display).toBe('');
            expect(document.getElementById('errorAlert').style.display).toBe('none');
            expect(document.getElementById('errorAlert').textContent).toBe('');
        });
    });
});
