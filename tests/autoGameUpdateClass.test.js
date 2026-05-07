import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoGameUpdate, LOCALSTORAGE_JWTKEY, LOCALSTORAGE_COMMANDREPLYTEMPLATE,
    LOCALSTORAGE_CHANNEL, LOCALSTORAGE_CUSTOM_STEAMID,
    LOCALSTORAGE_CUSTOM_SE_CHANNEL, LOCALSTORAGE_CUSTOM_SE_COMMAND } from '../src/autoGameUpdateClass.js';
import * as utils from '../src/utils.js';

// 掛載全域函數（class 用 /* global */ 引用）
globalThis.addLog = utils.addLog;
globalThis.logStep = utils.logStep;
globalThis.hideAllAlerts = utils.hideAllAlerts;
globalThis.showError = utils.showError;
globalThis.showSuccess = utils.showSuccess;
globalThis.getOverrideWarningText = utils.getOverrideWarningText;
globalThis.getTemplateWarningText = utils.getTemplateWarningText;

function setupDOM() {
    document.body.innerHTML = `
        <select id="channel">
            <option value="shuteye_orange"
                    data-steamid="76561198003344359"
                    data-se-channel="ch-orange"
                    data-se-command="cmd-orange">蝦愛橘子</option>
            <option value="marsantonymars"
                    data-steamid="76561197999639100"
                    data-se-channel="ch-mars"
                    data-se-command="cmd-mars">姬柊雪菜我老婆</option>
            <option value="__custom__">自訂...</option>
        </select>
        <div id="customChannelFields" style="display:none;">
            <input type="text" id="customSteamId" />
            <input type="text" id="customSeChannel" />
            <input type="text" id="customSeCommand" />
        </div>
        <input type="password" id="JWTKey" value="test-jwt" />
        <input type="text" id="gameName" value="" />
        <span id="gameNameOverrideWarning" class="form-warning"></span>
        <input type="text" id="commandReplyTemplate" value="目前遊戲：{game}" />
        <span id="templateWarning" class="form-warning-strong"></span>
        <span id="currentSteamGameName"></span>
        <span id="currentCommandReply"></span>
        <div id="replyPreview" class="readout readout-empty">（尚未取得遊戲名稱，請按「立即更新」）</div>
        <textarea id="log"></textarea>
        <div id="successAlert" style="display:none;"></div>
        <div id="errorAlert" style="display:none;"></div>
        <input type="button" id="immediatelyUpdate" />
        <input type="button" id="startAutoUpdate" />
        <input type="button" id="stopAutoUpdate" style="display:none;" />
        <button id="loading" style="display:none;"><span id="nextUpdateStamp">Loading...</span></button>
    `;
}

function createInstance(mockFetch) {
    return new AutoGameUpdate({ fetchFn: mockFetch });
}

beforeEach(() => {
    setupDOM();
    localStorage.clear();
    sessionStorage.clear();
    // 預設 template，讓 init() 載入時有值
    localStorage.setItem(LOCALSTORAGE_COMMANDREPLYTEMPLATE, '目前遊戲：{game}');
});

describe('AutoGameUpdate', () => {
    describe('init', () => {
        it('從 storage 載入設定（JWT 用 sessionStorage，template 用 localStorage）', () => {
            sessionStorage.setItem(LOCALSTORAGE_JWTKEY, 'saved-jwt');
            localStorage.setItem(LOCALSTORAGE_COMMANDREPLYTEMPLATE, '模板：{game}');

            var instance = createInstance(vi.fn());
            instance.init();

            expect(document.getElementById('JWTKey').value).toBe('saved-jwt');
            expect(document.getElementById('commandReplyTemplate').value).toBe('模板：{game}');
        });

        it('sessionStorage 沒值時 JWTKey 設為空字串', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            expect(document.getElementById('JWTKey').value).toBe('');
        });
    });

    describe('頻道選擇', () => {
        it('預設選第一個頻道的 steamid', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ GameName: '' }),
                })
            );
            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            expect(mockFetch).toHaveBeenCalled();
            expect(mockFetch.mock.calls[0][0]).toContain('steamid=76561198003344359');
        });

        it('切換頻道後使用新的 steamid', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ GameName: '' }),
                })
            );
            var instance = createInstance(mockFetch);
            instance.init();

            document.getElementById('channel').value = 'marsantonymars';
            await instance.mainProcess();

            expect(mockFetch.mock.calls[0][0]).toContain('steamid=76561197999639100');
        });

        it('切換頻道後使用對應的 StreamElements channelId', async () => {
            var callUrls = [];
            var mockFetch = vi.fn((url) => {
                callUrls.push(url);
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'TestGame' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '舊內容' }),
                });
            });
            var instance = createInstance(mockFetch);
            instance.init();

            document.getElementById('channel').value = 'marsantonymars';
            await instance.mainProcess();

            var seCall = callUrls.find(u => u.includes('streamelements'));
            expect(seCall).toContain('ch-mars');
            expect(seCall).toContain('cmd-mars');
        });
    });

    describe('mainProcess', () => {
        it('Steam 回傳遊戲名稱時更新 UI 並呼叫 StreamElements PUT', async () => {
            var putBody = null;
            var mockFetch = vi.fn((url, opts) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Elden Ring' }),
                    });
                }
                if (opts && opts.method === 'PUT') {
                    putBody = JSON.parse(opts.body);
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ reply: putBody.reply }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '舊內容' }),
                });
            });

            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            expect(document.getElementById('currentSteamGameName').textContent).toBe('Elden Ring');
            expect(putBody.reply).toBe('目前遊戲：Elden Ring');
            expect(document.getElementById('currentCommandReply').textContent).toBe('目前遊戲：Elden Ring');
            expect(document.getElementById('successAlert').style.display).not.toBe('none');
        });

        it('Steam 沒抓到遊戲時 UI 顯示空，但指令回覆不變', async () => {
            var callCount = 0;
            var currentReply = '舊內容';
            var mockFetch = vi.fn((url, opts) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    callCount++;
                    var gameName = callCount === 1 ? 'Elden Ring' : '';
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: gameName }),
                    });
                }
                if (opts && opts.method === 'PUT') {
                    var body = JSON.parse(opts.body);
                    currentReply = body.reply;
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ reply: body.reply }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: currentReply }),
                });
            });

            var instance = createInstance(mockFetch);
            instance.init();

            await instance.mainProcess();
            expect(document.getElementById('currentSteamGameName').textContent).toBe('Elden Ring');
            expect(document.getElementById('currentCommandReply').textContent).toBe('目前遊戲：Elden Ring');

            await instance.mainProcess();
            expect(document.getElementById('currentSteamGameName').textContent).toBe('');
            expect(document.getElementById('currentCommandReply').textContent).toBe('目前遊戲：Elden Ring');
        });

        it('Steam 沒在玩遊戲且沒自訂名稱時不呼叫 PUT', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: '' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '目前遊戲：之前的遊戲' }),
                });
            });

            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            expect(mockFetch).toHaveBeenCalledTimes(2);
            var putCalls = mockFetch.mock.calls.filter(function(c) { return c[1] && c[1].method === 'PUT'; });
            expect(putCalls).toHaveLength(0);
            expect(document.getElementById('currentCommandReply').textContent).toBe('目前遊戲：之前的遊戲');
        });

        it('自訂遊戲名稱優先於 Steam', async () => {
            var putBody = null;
            var mockFetch = vi.fn((url, opts) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Elden Ring' }),
                    });
                }
                if (opts && opts.method === 'PUT') {
                    putBody = JSON.parse(opts.body);
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ reply: putBody.reply }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '舊內容' }),
                });
            });

            var instance = createInstance(mockFetch);
            instance.init();
            document.getElementById('gameName').value = '自訂遊戲';
            await instance.mainProcess();

            expect(putBody.reply).toBe('目前遊戲：自訂遊戲');
        });

        it('遊戲名稱沒變時不呼叫 PUT', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Elden Ring' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '目前遊戲：Elden Ring' }),
                });
            });

            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('Steam API 失敗時顯示錯誤', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' })
            );

            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            expect(document.getElementById('errorAlert').style.display).not.toBe('none');
            expect(document.getElementById('errorAlert').innerHTML).toContain('無法取得');
        });
    });

    describe('結構化 log（Phase 2）', () => {
        it('catch block 把錯誤寫進 log textarea', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' })
            );
            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('✗');
            expect(logValue).toContain('流程終止');
            expect(logValue).toContain('無法取得');
        });

        it('SE GET 401 在 log 中含 JWT 過期提示', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Test' }),
                    });
                }
                return Promise.resolve({ ok: false, status: 401, statusText: 'Unauthorized' });
            });
            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('JWT 無效或過期');
        });

        it('SE GET 404 在 log 中含 channel/command 錯誤提示', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Test' }),
                    });
                }
                return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
            });
            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('channel 或 command ID 錯誤');
        });

        it('SE PUT 401 在 log 中含 Bot Moderator 提示', async () => {
            var mockFetch = vi.fn((url, opts) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Sura Demo' }),
                    });
                }
                if (opts && opts.method === 'PUT') {
                    return Promise.resolve({ ok: false, status: 401, statusText: 'Unauthorized' });
                }
                // SE GET 成功，回傳舊 reply（會觸發 PUT 嘗試）
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '目前遊戲：舊遊戲' }),
                });
            });
            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('Bot Moderator');
        });

        it('reply 已是最新時 log 顯示「跳過更新」', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Sura Demo' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '目前遊戲：Sura Demo' }),
                });
            });
            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('↪');
            expect(logValue).toContain('跳過更新');
            expect(logValue).toContain('Sura Demo');
        });

        it('自訂遊戲名稱有值時 log 顯示覆寫提醒', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Sura Demo' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '舊內容' }),
                });
            });
            var instance = createInstance(mockFetch);
            instance.init();
            document.getElementById('gameName').value = '蓋掉';
            await instance.mainProcess();

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('已覆寫 Steam 結果');
            expect(logValue).toContain('「蓋掉」');
        });

        it('Template 缺 {game} 時 log 顯示警告', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Sura Demo' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '舊內容' }),
                });
            });
            var instance = createInstance(mockFetch);
            instance.init();
            document.getElementById('commandReplyTemplate').value = '硬寫的內容（缺佔位符）';
            await instance.mainProcess();

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('Template 缺少 {game}');
        });

        it('開始 / 結束標記出現在 log', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ GameName: '' }),
                })
            );
            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('完整流程開始');
            expect(logValue).toContain('完整流程結束');
        });

        it('log 不應出現 JWT 字串', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Sura Demo' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '目前遊戲：Sura Demo' }),
                });
            });
            var instance = createInstance(mockFetch);
            instance.init();
            document.getElementById('JWTKey').value = 'super-secret-jwt-token-12345';
            await instance.mainProcess();

            var logValue = document.getElementById('log').value;
            expect(logValue).not.toContain('super-secret-jwt-token-12345');
        });
    });

    describe('UI 警告與預覽（Phase 3）', () => {
        it('填自訂遊戲名稱後 input 事件觸發 warning 顯示', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var input = document.getElementById('gameName');
            input.value = '我的遊戲';
            input.dispatchEvent(new Event('input'));

            var warning = document.getElementById('gameNameOverrideWarning').textContent;
            expect(warning).toContain('已覆寫 Steam 結果');
            expect(warning).toContain('「我的遊戲」');
        });

        it('清空自訂遊戲名稱後 warning 消失', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var input = document.getElementById('gameName');
            input.value = '先填';
            input.dispatchEvent(new Event('input'));
            input.value = '';
            input.dispatchEvent(new Event('input'));

            expect(document.getElementById('gameNameOverrideWarning').textContent).toBe('');
        });

        it('Template 不含 {game} 時 warning 顯示', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var input = document.getElementById('commandReplyTemplate');
            input.value = '硬寫不用佔位符';
            input.dispatchEvent(new Event('input'));

            expect(document.getElementById('templateWarning').textContent).toContain('Template 缺少 {game}');
        });

        it('Template 含 {game} 時 warning 不顯示', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var input = document.getElementById('commandReplyTemplate');
            input.value = '遊戲：{game}';
            input.dispatchEvent(new Event('input'));

            expect(document.getElementById('templateWarning').textContent).toBe('');
        });

        it('Template 為空時 warning 不顯示（empty 不是 will-break）', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var input = document.getElementById('commandReplyTemplate');
            input.value = '';
            input.dispatchEvent(new Event('input'));

            expect(document.getElementById('templateWarning').textContent).toBe('');
        });

        it('init 時 customName 已存在則 warning 立刻渲染', () => {
            document.getElementById('gameName').value = '我自訂的';
            var instance = createInstance(vi.fn());
            instance.init();

            expect(document.getElementById('gameNameOverrideWarning').textContent)
                .toContain('「我自訂的」');
        });

        it('預覽：填 customName + template 顯示 substitution 結果', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var gn = document.getElementById('gameName');
            gn.value = 'Sura Demo';
            gn.dispatchEvent(new Event('input'));

            var preview = document.getElementById('replyPreview');
            expect(preview.textContent).toBe('目前遊戲：Sura Demo');
            expect(preview.classList.contains('readout-empty')).toBe(false);
        });

        it('預覽：沒 customName 也沒 steamGameName 時為 empty 狀態', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var preview = document.getElementById('replyPreview');
            expect(preview.classList.contains('readout-empty')).toBe(true);
            expect(preview.textContent).toContain('尚未取得遊戲名稱');
        });

        it('預覽：template 為空時顯示「Template 為空」', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var tpl = document.getElementById('commandReplyTemplate');
            tpl.value = '';
            tpl.dispatchEvent(new Event('input'));

            var preview = document.getElementById('replyPreview');
            expect(preview.textContent).toContain('Template 為空');
            expect(preview.classList.contains('readout-empty')).toBe(true);
        });

        it('預覽：mainProcess 跑完後 steamGameName 反映到預覽', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Elden Ring' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '目前遊戲：Elden Ring' }),
                });
            });
            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            var preview = document.getElementById('replyPreview');
            expect(preview.textContent).toBe('目前遊戲：Elden Ring');
        });

        it('預覽：customName 優先於 steamGameName', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: 'Steam 抓的' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reply: '舊內容' }),
                });
            });
            var instance = createInstance(mockFetch);
            instance.init();
            document.getElementById('gameName').value = '自訂的';
            await instance.mainProcess();

            var preview = document.getElementById('replyPreview');
            expect(preview.textContent).toBe('目前遊戲：自訂的');
        });

        it('預覽：template 不含 {game} 時顯示原 template', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var gn = document.getElementById('gameName');
            gn.value = 'Sura Demo';
            gn.dispatchEvent(new Event('input'));

            var tpl = document.getElementById('commandReplyTemplate');
            tpl.value = '硬寫不用佔位符';
            tpl.dispatchEvent(new Event('input'));

            var preview = document.getElementById('replyPreview');
            expect(preview.textContent).toBe('硬寫不用佔位符');
        });
    });

    describe('Loop log（Phase 2）', () => {
        it('startAutoUpdate 點擊後 log 顯示開始自動更新', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ GameName: '' }),
                })
            );
            var instance = createInstance(mockFetch);
            instance.init();

            document.getElementById('startAutoUpdate').click();
            await vi.waitFor(() => {
                expect(document.getElementById('channel').disabled).toBe(true);
            });

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('▶ 開始自動更新');
            instance.stop();
        });

        it('stop 後 log 顯示停止自動更新', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ GameName: '' }),
                })
            );
            var instance = createInstance(mockFetch);
            instance.init();

            document.getElementById('startAutoUpdate').click();
            await vi.waitFor(() => {
                expect(document.getElementById('channel').disabled).toBe(true);
            });
            instance.stop();

            var logValue = document.getElementById('log').value;
            expect(logValue).toContain('■ 停止自動更新');
        });
    });

    describe('stop', () => {
        it('沒啟動時 stop 不會出錯', () => {
            var instance = createInstance(vi.fn());
            instance.init();
            instance.stop();

            expect(instance.isRunning).toBe(false);
        });

        it('停止後頻道下拉選單恢復可選', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ GameName: '' }),
                })
            );
            var instance = createInstance(mockFetch);
            instance.init();

            document.getElementById('startAutoUpdate').click();
            await vi.waitFor(() => {
                expect(document.getElementById('channel').disabled).toBe(true);
            });

            instance.stop();
            expect(document.getElementById('channel').disabled).toBe(false);
            expect(document.getElementById('startAutoUpdate').style.display).not.toBe('none');
            expect(document.getElementById('stopAutoUpdate').style.display).toBe('none');
        });
    });

    describe('設定儲存', () => {
        it('點擊立即更新時 JWT 存到 sessionStorage', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ GameName: '' }),
                })
            );
            var instance = createInstance(mockFetch);
            instance.init();

            document.getElementById('JWTKey').value = 'my-jwt-key';
            document.getElementById('immediatelyUpdate').click();

            await vi.waitFor(() => {
                expect(sessionStorage.getItem(LOCALSTORAGE_JWTKEY)).toBe('my-jwt-key');
            });
            expect(localStorage.getItem(LOCALSTORAGE_JWTKEY)).toBeNull();
        });

        it('點擊立即更新時頻道選擇存到 localStorage', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ GameName: '' }),
                })
            );
            var instance = createInstance(mockFetch);
            instance.init();

            document.getElementById('channel').value = 'marsantonymars';
            document.getElementById('immediatelyUpdate').click();

            await vi.waitFor(() => {
                expect(localStorage.getItem(LOCALSTORAGE_CHANNEL)).toBe('marsantonymars');
            });
        });
    });

    describe('自訂頻道', () => {
        it('選擇自訂時顯示自訂欄位', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var channelEl = document.getElementById('channel');
            channelEl.value = '__custom__';
            channelEl.dispatchEvent(new Event('change'));

            expect(document.getElementById('customChannelFields').style.display).not.toBe('none');
        });

        it('切回預設頻道時隱藏自訂欄位', () => {
            var instance = createInstance(vi.fn());
            instance.init();

            var channelEl = document.getElementById('channel');
            channelEl.value = '__custom__';
            channelEl.dispatchEvent(new Event('change'));
            channelEl.value = 'shuteye_orange';
            channelEl.dispatchEvent(new Event('change'));

            expect(document.getElementById('customChannelFields').style.display).toBe('none');
        });

        it('選擇自訂時使用自訂欄位的值', async () => {
            var mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ GameName: '' }),
                })
            );
            var instance = createInstance(mockFetch);
            instance.init();

            document.getElementById('channel').value = '__custom__';
            document.getElementById('customSteamId').value = '11111111111111111';
            document.getElementById('customSeChannel').value = 'custom-ch';
            document.getElementById('customSeCommand').value = 'custom-cmd';
            await instance.mainProcess();

            expect(mockFetch.mock.calls[0][0]).toContain('steamid=11111111111111111');
            var seCall = mockFetch.mock.calls.find(function (c) { return c[0].includes('streamelements'); });
            expect(seCall[0]).toContain('custom-ch');
            expect(seCall[0]).toContain('custom-cmd');
        });

        it('init 時還原已儲存的頻道選擇', () => {
            localStorage.setItem(LOCALSTORAGE_CHANNEL, 'marsantonymars');
            var instance = createInstance(vi.fn());
            instance.init();

            expect(document.getElementById('channel').value).toBe('marsantonymars');
        });

        it('init 時還原自訂頻道並顯示自訂欄位', () => {
            localStorage.setItem(LOCALSTORAGE_CHANNEL, '__custom__');
            localStorage.setItem(LOCALSTORAGE_CUSTOM_STEAMID, '99999999999999999');
            localStorage.setItem(LOCALSTORAGE_CUSTOM_SE_CHANNEL, 'saved-ch');
            localStorage.setItem(LOCALSTORAGE_CUSTOM_SE_COMMAND, 'saved-cmd');

            var instance = createInstance(vi.fn());
            instance.init();

            expect(document.getElementById('channel').value).toBe('__custom__');
            expect(document.getElementById('customSteamId').value).toBe('99999999999999999');
            expect(document.getElementById('customSeChannel').value).toBe('saved-ch');
            expect(document.getElementById('customSeCommand').value).toBe('saved-cmd');
            expect(document.getElementById('customChannelFields').style.display).not.toBe('none');
        });
    });
});
