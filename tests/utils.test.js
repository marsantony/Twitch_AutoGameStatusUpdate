import { describe, it, expect, beforeEach } from 'vitest';
import { addLog, logStep, hideAllAlerts, showError, showSuccess } from '../src/utils.js';

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

        it('字串輸入不被加 JSON 引號', () => {
            addLog('純文字');
            var logEl = document.getElementById('log');
            // 不應出現 JSON 序列化的雙引號包字串
            expect(logEl.value).not.toContain('"純文字"');
            expect(logEl.value).toContain('純文字');
        });

        it('物件輸入仍會 JSON 序列化', () => {
            addLog({ GameName: 'Sura Demo' });
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('"GameName"');
            expect(logEl.value).toContain('"Sura Demo"');
        });
    });

    describe('logStep', () => {
        it('只給 title 時輸出 ▶ 前綴', () => {
            logStep('開始');
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('▶ 開始');
        });

        it('method + url 渲染為 → 行', () => {
            logStep('取資料', { method: 'GET', url: 'https://example.com/api' });
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('→ GET https://example.com/api');
        });

        it('response 渲染為 ← 行（JSON）', () => {
            logStep('取資料', { response: { GameName: 'Sura Demo' } });
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('← Response:');
            expect(logEl.value).toContain('"GameName"');
        });

        it('body 渲染為 → Body 行', () => {
            logStep('PUT 更新', { body: { reply: 'hi' } });
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('→ Body:');
            expect(logEl.value).toContain('"reply"');
        });

        it('ok 渲染為 ✓ 行', () => {
            logStep('取資料', { ok: '取得「Sura Demo」' });
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('✓ 取得「Sura Demo」');
        });

        it('skip 渲染為 ↪ 行', () => {
            logStep('比對 reply', { skip: 'reply 已是最新' });
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('↪ reply 已是最新');
        });

        it('error 渲染為 ✗ 行', () => {
            logStep('SE GET', { error: '401 Unauthorized' });
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('✗ 401 Unauthorized');
        });

        it('多欄位同時出現', () => {
            logStep('完整呼叫', {
                method: 'GET',
                url: 'https://api.example.com',
                response: { ok: 1 },
                ok: '成功'
            });
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('▶ 完整呼叫');
            expect(logEl.value).toContain('→ GET');
            expect(logEl.value).toContain('← Response:');
            expect(logEl.value).toContain('✓ 成功');
        });

        it('沒給 info 時不會炸（默認空物件）', () => {
            expect(() => logStep('裸 title')).not.toThrow();
            var logEl = document.getElementById('log');
            expect(logEl.value).toContain('▶ 裸 title');
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
