import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoGameUpdate, LOCALSTORAGE_JWTKEY, LOCALSTORAGE_COMMANDREPLYTEMPLATE } from '../src/autoGameUpdateClass.js';
import * as utils from '../src/utils.js';

// 掛載全域函數（class 用 /* global */ 引用）
globalThis.addLog = utils.addLog;
globalThis.hideAllAlerts = utils.hideAllAlerts;
globalThis.showError = utils.showError;
globalThis.showSuccess = utils.showSuccess;

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
        </select>
        <input type="password" id="JWTKey" value="test-jwt" />
        <input type="text" id="gameName" value="" />
        <input type="text" id="commandReplyTemplate" value="目前遊戲：{game}" />
        <span id="currentSteamGameName"></span>
        <span id="currentCommandReply"></span>
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
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ reply: body.reply }),
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
            expect(document.getElementById('currentCommandReply').textContent).toBe('目前遊戲：Elden Ring');

            await instance.mainProcess();
            expect(document.getElementById('currentSteamGameName').textContent).toBe('');
            expect(document.getElementById('currentCommandReply').textContent).toBe('目前遊戲：Elden Ring');
        });

        it('Steam 沒在玩遊戲且沒自訂名稱時不呼叫 StreamElements', async () => {
            var mockFetch = vi.fn((url) => {
                if (typeof url === 'string' && url.includes('GetSteamStatus')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ GameName: '' }),
                    });
                }
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            });

            var instance = createInstance(mockFetch);
            instance.init();
            await instance.mainProcess();

            expect(mockFetch).toHaveBeenCalledTimes(1);
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
            expect(document.getElementById('errorAlert').innerHTML).toContain('無法取得steam狀態');
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
    });
});
