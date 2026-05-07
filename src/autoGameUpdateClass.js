/* global addLog, logStep, hideAllAlerts, showError, showSuccess,
          getOverrideWarningText, getTemplateWarningText */

const STEAM_API_BASE = 'https://asia-east1-steamwebapi-394409.cloudfunctions.net/GetSteamStatus';
const SE_API_BASE = 'https://api.streamelements.com/kappa/v2/bot/commands';

const LOCALSTORAGE_JWTKEY = 'Twitch_AutoGameStatusUpdate_JWTKey';
const LOCALSTORAGE_COMMANDREPLYTEMPLATE = 'Twitch_AutoGameStatusUpdate_CommandReplyTemplate';
const LOCALSTORAGE_CHANNEL = 'Twitch_AutoGameStatusUpdate_Channel';
const LOCALSTORAGE_CUSTOM_STEAMID = 'Twitch_AutoGameStatusUpdate_CustomSteamId';
const LOCALSTORAGE_CUSTOM_SE_CHANNEL = 'Twitch_AutoGameStatusUpdate_CustomSeChannel';
const LOCALSTORAGE_CUSTOM_SE_COMMAND = 'Twitch_AutoGameStatusUpdate_CustomSeCommand';

class AutoGameUpdate {
    #channelId = '';
    #updateCommandId = '';
    #steamId = '';
    #interval = null;
    #isRunning = false;
    #fetchFn;
    #autoUpdateMinutes = 5;

    constructor(deps) {
        this.#fetchFn = (deps && deps.fetchFn) || fetch.bind(window);
    }

    get isRunning() {
        return this.#isRunning;
    }

    #readChannelConfig() {
        const channelEl = document.getElementById('channel');
        const selected = channelEl.selectedOptions[0];
        if (channelEl.value === '__custom__') {
            this.#steamId = (document.getElementById('customSteamId') || {}).value || '';
            this.#channelId = (document.getElementById('customSeChannel') || {}).value || '';
            this.#updateCommandId = (document.getElementById('customSeCommand') || {}).value || '';
        } else {
            this.#channelId = (selected && selected.dataset.seChannel) || '';
            this.#updateCommandId = (selected && selected.dataset.seCommand) || '';
            this.#steamId = (selected && selected.dataset.steamid) || '';
        }
    }

    #toggleCustomFields() {
        const channelEl = document.getElementById('channel');
        const customFields = document.getElementById('customChannelFields');
        if (customFields) {
            customFields.style.display = channelEl.value === '__custom__' ? '' : 'none';
        }
    }

    #updateOverrideWarning() {
        const el = document.getElementById('gameNameOverrideWarning');
        if (!el) return;
        el.textContent = getOverrideWarningText(document.getElementById('gameName').value);
    }

    #updateTemplateWarning() {
        const el = document.getElementById('templateWarning');
        if (!el) return;
        el.textContent = getTemplateWarningText(document.getElementById('commandReplyTemplate').value);
    }

    #updateReplyPreview() {
        const previewEl = document.getElementById('replyPreview');
        if (!previewEl) return;
        const customName = document.getElementById('gameName').value;
        const template = document.getElementById('commandReplyTemplate').value;
        const lastSteamGameName = document.getElementById('currentSteamGameName').textContent;
        const effectiveName = customName || lastSteamGameName;

        if (!template) {
            previewEl.textContent = '（Template 為空）';
            previewEl.classList.add('readout-empty');
            return;
        }
        if (!effectiveName) {
            previewEl.textContent = '（尚未取得遊戲名稱，請按「立即更新」）';
            previewEl.classList.add('readout-empty');
            return;
        }
        previewEl.classList.remove('readout-empty');
        previewEl.textContent = template.replace(/{game}/g, effectiveName);
    }

    async getSteamStatus() {
        const url = STEAM_API_BASE + '?steamid=' + encodeURIComponent(this.#steamId);
        const response = await this.#fetchFn(url);
        if (!response.ok) {
            logStep('取得 Steam 遊戲狀態', {
                method: 'GET', url,
                error: response.status + ' ' + response.statusText
            });
            throw new Error(response.status + ':' + response.statusText);
        }
        const data = await response.json();
        const gameName = data['GameName'] || '';
        logStep('取得 Steam 遊戲狀態', {
            method: 'GET', url,
            response: data,
            ok: gameName
                ? '取得遊戲名稱「' + gameName + '」'
                : '⚠ 未取得遊戲名稱（可能：沒玩遊戲 / Steam 隱私為非公開 / 遊戲詳細資料未公開）'
        });
        return gameName;
    }

    #buildSeHeaders(hasBody) {
        const jwtKey = document.getElementById('JWTKey').value;
        const h = {
            'Accept': 'application/json; charset=utf-8, application/json',
            'Authorization': 'Bearer ' + jwtKey
        };
        if (hasBody) h['Content-Type'] = 'application/json';
        return h;
    }

    async getStreamelementsCommand() {
        const url = SE_API_BASE + '/' + this.#channelId + '/' + this.#updateCommandId;
        const response = await this.#fetchFn(url, { headers: this.#buildSeHeaders(false) });
        if (!response.ok) {
            const hint = response.status === 401 ? '（JWT 無效或過期）'
                : response.status === 404 ? '（channel 或 command ID 錯誤）'
                : '';
            logStep('取得 SE 指令', {
                method: 'GET', url,
                error: response.status + ' ' + response.statusText + hint
            });
            throw new Error(response.status + ':' + response.statusText);
        }
        const data = await response.json();
        logStep('取得 SE 指令', {
            method: 'GET', url,
            response: { command: data.command, reply: data.reply, _id: data._id },
            ok: '目前 reply：「' + (data.reply || '(空)') + '」'
        });
        return data;
    }

    async updateStreamelementsCommand(commandJson) {
        const url = SE_API_BASE + '/' + this.#channelId + '/' + this.#updateCommandId;
        const response = await this.#fetchFn(url, {
            method: 'PUT',
            headers: this.#buildSeHeaders(true),
            body: JSON.stringify(commandJson),
        });
        if (!response.ok) {
            const hint = response.status === 401
                ? '（JWT 無權更新此 channel，請確認頻道主已將你設為 Bot Moderator）'
                : '';
            logStep('更新 SE 指令', {
                method: 'PUT', url,
                body: { reply: commandJson.reply },
                error: response.status + ' ' + response.statusText + hint
            });
            throw new Error(response.status + ':' + response.statusText);
        }
        const data = await response.json();
        logStep('更新 SE 指令', {
            method: 'PUT', url,
            body: { reply: commandJson.reply },
            response: { reply: data.reply, _id: data._id },
            ok: '更新成功，新 reply：「' + data.reply + '」'
        });
        return data;
    }

    async mainProcess() {
        let errorMsg = '';
        try {
            addLog('───── 完整流程開始 ─────');
            hideAllAlerts();
            this.#readChannelConfig();

            const customName = document.getElementById('gameName').value;
            const overrideMsg = getOverrideWarningText(customName);
            if (overrideMsg) addLog('⚠ ' + overrideMsg);

            const template = document.getElementById('commandReplyTemplate').value;
            const templateMsg = getTemplateWarningText(template);
            if (templateMsg) addLog('⚠ ' + templateMsg);

            errorMsg = '無法取得steam狀態';
            const steamGameName = await this.getSteamStatus();
            document.getElementById('currentSteamGameName').textContent = steamGameName;

            const currentGameName = customName || steamGameName;

            errorMsg = '無法取得目前指令的內容';
            let commandJson = await this.getStreamelementsCommand();

            if (currentGameName) {
                const templateFullReply = template.replace(/{game}/g, currentGameName);
                logStep('比對 reply', {
                    ok: '目標：「' + templateFullReply + '」 ／ 當前：「' + commandJson['reply'] + '」'
                });

                if (commandJson['reply'] !== templateFullReply) {
                    commandJson['reply'] = templateFullReply;
                    errorMsg = '無法更新目前指令的內容';
                    commandJson = await this.updateStreamelementsCommand(commandJson);
                    showSuccess('更新成功<br/>' + commandJson['reply']);
                } else {
                    logStep('比對 reply', { skip: 'reply 已是最新（' + currentGameName + '），跳過更新' });
                }
            } else {
                logStep('比對 reply', { skip: '無有效遊戲名稱（Steam 為空且未設自訂），不更新 SE' });
            }

            const currentCommandReplyEl = document.getElementById('currentCommandReply');
            if (currentCommandReplyEl) currentCommandReplyEl.textContent = commandJson['reply'] || '';
        } catch (error) {
            logStep('流程終止', { error: errorMsg + '：' + String(error) });
            showError(errorMsg + '\n給開發者的錯誤訊息內容：' + error);
        } finally {
            addLog('───── 完整流程結束 ─────');
            this.#updateReplyPreview();
        }
    }

    init() {
        document.getElementById('immediatelyUpdate').addEventListener('click', async () => {
            this.#saveSettings();
            await this.mainProcess();
        });

        document.getElementById('startAutoUpdate').addEventListener('click', async () => {
            this.#saveSettings();
            await this.#startLoop();
        });

        document.getElementById('stopAutoUpdate').addEventListener('click', () => {
            this.stop();
        });

        const channelEl = document.getElementById('channel');
        channelEl.addEventListener('change', () => {
            this.#toggleCustomFields();
        });

        document.getElementById('gameName').addEventListener('input', () => {
            this.#updateOverrideWarning();
            this.#updateReplyPreview();
        });
        document.getElementById('commandReplyTemplate').addEventListener('input', () => {
            this.#updateTemplateWarning();
            this.#updateReplyPreview();
        });

        // 載入設定（JWT 用 sessionStorage，其餘用 localStorage）
        document.getElementById('JWTKey').value =
            sessionStorage.getItem(LOCALSTORAGE_JWTKEY) || '';
        document.getElementById('commandReplyTemplate').value =
            localStorage.getItem(LOCALSTORAGE_COMMANDREPLYTEMPLATE) || '';

        // 還原頻道選擇
        const savedChannel = localStorage.getItem(LOCALSTORAGE_CHANNEL) || '';
        if (savedChannel) {
            const hasOption = Array.from(channelEl.options).some((o) => o.value === savedChannel);
            if (hasOption) channelEl.value = savedChannel;
        }

        // 還原自訂欄位
        const customSteamIdEl = document.getElementById('customSteamId');
        const customSeChannelEl = document.getElementById('customSeChannel');
        const customSeCommandEl = document.getElementById('customSeCommand');
        if (customSteamIdEl) customSteamIdEl.value = localStorage.getItem(LOCALSTORAGE_CUSTOM_STEAMID) || '';
        if (customSeChannelEl) customSeChannelEl.value = localStorage.getItem(LOCALSTORAGE_CUSTOM_SE_CHANNEL) || '';
        if (customSeCommandEl) customSeCommandEl.value = localStorage.getItem(LOCALSTORAGE_CUSTOM_SE_COMMAND) || '';

        this.#toggleCustomFields();

        // 還原欄位後初次渲染警告與預覽
        this.#updateOverrideWarning();
        this.#updateTemplateWarning();
        this.#updateReplyPreview();
    }

    async #startLoop() {
        if (this.#isRunning) return;
        this.#isRunning = true;
        addLog('▶ 開始自動更新（每 ' + this.#autoUpdateMinutes + ' 分鐘一次）');

        document.getElementById('channel').disabled = true;
        document.getElementById('immediatelyUpdate').style.display = 'none';
        document.getElementById('startAutoUpdate').style.display = 'none';
        document.getElementById('stopAutoUpdate').style.display = '';
        document.getElementById('loading').style.display = '';

        const runOnce = async () => {
            await this.mainProcess();
            const now = new Date();
            now.setMinutes(now.getMinutes() + this.#autoUpdateMinutes);
            document.getElementById('nextUpdateStamp').textContent =
                '下次自動更新時間：' + now.toLocaleString();
            this.#interval = setTimeout(runOnce, this.#autoUpdateMinutes * 60 * 1000);
        };
        await runOnce();
    }

    stop() {
        if (!this.#isRunning) return;
        this.#isRunning = false;
        addLog('■ 停止自動更新');

        if (this.#interval) {
            clearTimeout(this.#interval);
            this.#interval = null;
        }

        document.getElementById('channel').disabled = false;
        document.getElementById('immediatelyUpdate').style.display = '';
        document.getElementById('startAutoUpdate').style.display = '';
        document.getElementById('stopAutoUpdate').style.display = 'none';
        document.getElementById('loading').style.display = 'none';
        document.getElementById('nextUpdateStamp').textContent = 'Loading...';
    }

    #saveSettings() {
        sessionStorage.setItem(LOCALSTORAGE_JWTKEY, document.getElementById('JWTKey').value);
        localStorage.setItem(LOCALSTORAGE_COMMANDREPLYTEMPLATE, document.getElementById('commandReplyTemplate').value);
        localStorage.setItem(LOCALSTORAGE_CHANNEL, document.getElementById('channel').value);

        const customSteamIdEl = document.getElementById('customSteamId');
        const customSeChannelEl = document.getElementById('customSeChannel');
        const customSeCommandEl = document.getElementById('customSeCommand');
        if (customSteamIdEl) localStorage.setItem(LOCALSTORAGE_CUSTOM_STEAMID, customSteamIdEl.value);
        if (customSeChannelEl) localStorage.setItem(LOCALSTORAGE_CUSTOM_SE_CHANNEL, customSeChannelEl.value);
        if (customSeCommandEl) localStorage.setItem(LOCALSTORAGE_CUSTOM_SE_COMMAND, customSeCommandEl.value);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AutoGameUpdate, STEAM_API_BASE, SE_API_BASE,
        LOCALSTORAGE_JWTKEY, LOCALSTORAGE_COMMANDREPLYTEMPLATE,
        LOCALSTORAGE_CHANNEL, LOCALSTORAGE_CUSTOM_STEAMID,
        LOCALSTORAGE_CUSTOM_SE_CHANNEL, LOCALSTORAGE_CUSTOM_SE_COMMAND };
}
