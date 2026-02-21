/* global addLog, hideAllAlerts, showError, showSuccess */

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
        var channelEl = document.getElementById('channel');
        var selected = channelEl.selectedOptions[0];
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
        var channelEl = document.getElementById('channel');
        var customFields = document.getElementById('customChannelFields');
        if (customFields) {
            customFields.style.display = channelEl.value === '__custom__' ? '' : 'none';
        }
    }

    async getSteamStatus() {
        var response = await this.#fetchFn(
            STEAM_API_BASE + '?steamid=' + encodeURIComponent(this.#steamId)
        );
        if (!response.ok) {
            throw new Error(response.status + ':' + response.statusText);
        }
        var data = await response.json();
        addLog(data);
        return data['GameName'] || '';
    }

    async getStreamelementsCommand() {
        var jwtKey = document.getElementById('JWTKey').value;
        var response = await this.#fetchFn(
            SE_API_BASE + '/' + this.#channelId + '/' + this.#updateCommandId,
            {
                headers: {
                    'Accept': 'application/json; charset=utf-8, application/json',
                    'Authorization': 'Bearer ' + jwtKey
                }
            }
        );
        if (!response.ok) {
            throw new Error(response.status + ':' + response.statusText);
        }
        var data = await response.json();
        addLog(data);
        return data;
    }

    async updateStreamelementsCommand(commandJson) {
        var jwtKey = document.getElementById('JWTKey').value;
        var response = await this.#fetchFn(
            SE_API_BASE + '/' + this.#channelId + '/' + this.#updateCommandId,
            {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json; charset=utf-8, application/json',
                    'Authorization': 'Bearer ' + jwtKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commandJson),
            }
        );
        if (!response.ok) {
            throw new Error(response.status + ':' + response.statusText);
        }
        var data = await response.json();
        addLog(data);
        return data;
    }

    async mainProcess() {
        var errorMsg = '';
        try {
            addLog('完整流程開始');
            hideAllAlerts();
            this.#readChannelConfig();

            errorMsg = '無法取得steam狀態';
            var steamGameName = await this.getSteamStatus();
            document.getElementById('currentSteamGameName').textContent = steamGameName;

            var currentGameName = document.getElementById('gameName').value || steamGameName;

            errorMsg = '無法取得目前指令的內容';
            var commandJson = await this.getStreamelementsCommand();

            if (currentGameName) {
                var template = document.getElementById('commandReplyTemplate').value;
                var templateFullReply = template.replace(/{game}/, currentGameName);

                if (commandJson['reply'] !== templateFullReply) {
                    commandJson['reply'] = templateFullReply;
                    errorMsg = '無法更新目前指令的內容';
                    commandJson = await this.updateStreamelementsCommand(commandJson);
                    showSuccess('更新成功<br/>' + commandJson['reply']);
                }
            }

            var currentCommandReplyEl = document.getElementById('currentCommandReply');
            if (currentCommandReplyEl) currentCommandReplyEl.textContent = commandJson['reply'] || '';
        } catch (error) {
            showError(errorMsg + '<br/>給開發者的錯誤訊息內容' + error);
        } finally {
            addLog('完整流程結束');
        }
    }

    init() {
        var self = this;

        document.getElementById('immediatelyUpdate').addEventListener('click', async function () {
            self.#saveSettings();
            await self.mainProcess();
        });

        document.getElementById('startAutoUpdate').addEventListener('click', async function () {
            self.#saveSettings();
            await self.#startLoop();
        });

        document.getElementById('stopAutoUpdate').addEventListener('click', function () {
            self.stop();
        });

        var channelEl = document.getElementById('channel');
        channelEl.addEventListener('change', function () {
            self.#toggleCustomFields();
        });

        // 載入設定（JWT 用 sessionStorage，其餘用 localStorage）
        document.getElementById('JWTKey').value =
            sessionStorage.getItem(LOCALSTORAGE_JWTKEY) || '';
        document.getElementById('commandReplyTemplate').value =
            localStorage.getItem(LOCALSTORAGE_COMMANDREPLYTEMPLATE) || '';

        // 還原頻道選擇
        var savedChannel = localStorage.getItem(LOCALSTORAGE_CHANNEL) || '';
        if (savedChannel) {
            var hasOption = Array.from(channelEl.options).some(function (o) { return o.value === savedChannel; });
            if (hasOption) channelEl.value = savedChannel;
        }

        // 還原自訂欄位
        var customSteamIdEl = document.getElementById('customSteamId');
        var customSeChannelEl = document.getElementById('customSeChannel');
        var customSeCommandEl = document.getElementById('customSeCommand');
        if (customSteamIdEl) customSteamIdEl.value = localStorage.getItem(LOCALSTORAGE_CUSTOM_STEAMID) || '';
        if (customSeChannelEl) customSeChannelEl.value = localStorage.getItem(LOCALSTORAGE_CUSTOM_SE_CHANNEL) || '';
        if (customSeCommandEl) customSeCommandEl.value = localStorage.getItem(LOCALSTORAGE_CUSTOM_SE_COMMAND) || '';

        this.#toggleCustomFields();
    }

    async #startLoop() {
        if (this.#isRunning) return;
        this.#isRunning = true;

        document.getElementById('channel').disabled = true;
        document.getElementById('immediatelyUpdate').style.display = 'none';
        document.getElementById('startAutoUpdate').style.display = 'none';
        document.getElementById('stopAutoUpdate').style.display = '';
        document.getElementById('loading').style.display = '';

        var self = this;
        var runOnce = async function () {
            await self.mainProcess();
            var now = new Date();
            now.setMinutes(now.getMinutes() + self.#autoUpdateMinutes);
            document.getElementById('nextUpdateStamp').textContent =
                '下次自動更新時間：' + now.toLocaleString();
            self.#interval = setTimeout(runOnce, self.#autoUpdateMinutes * 60 * 1000);
        };
        await runOnce();
    }

    stop() {
        if (!this.#isRunning) return;
        this.#isRunning = false;

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

        var customSteamIdEl = document.getElementById('customSteamId');
        var customSeChannelEl = document.getElementById('customSeChannel');
        var customSeCommandEl = document.getElementById('customSeCommand');
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
