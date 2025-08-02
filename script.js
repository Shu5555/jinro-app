// 簡素化されたJSONBinStorageクラス
class JSONBinStorage {
    constructor(apiKey) {
        if (!apiKey) throw new Error('JSONBin.io APIキーが提供されていません。');
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
    }
    async save(data) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': this.apiKey, 'X-Bin-Private': 'true' },
            body: JSON.stringify({ encryptedData: data })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`APIエラー: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        return result.metadata.id;
    }
    async load(binId) {
        const response = await fetch(`${this.baseUrl}/${binId}`, { headers: { 'X-Master-Key': this.apiKey } });
        if (!response.ok) {
            if (response.status === 404) throw new Error('データが見つかりません。URLの有効期限が切れているか、URLが間違っている可能性があります。');
            const errorText = await response.text();
            throw new Error(`APIエラー: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        if (result.record && result.record.encryptedData) return result.record.encryptedData;
        throw new Error("サーバーから取得したデータの形式が正しくありません。");
    }
}

// UI ヘルパー関数
function showLoading(message = 'Loading...') {
    let loader = document.getElementById('loading-overlay');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loading-overlay';
        loader.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(44,62,80,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;color:#ecf0f1;font-size:1.2em;font-family:'Noto Sans JP',sans-serif;`;
        document.body.appendChild(loader);
    }
    loader.innerHTML = `<div style="text-align:center;padding:20px;background:#34495e;border-radius:10px;border:1px solid #e74c3c;"><div style="margin-bottom:15px;font-size:2em;">🔄</div><div>${message}</div></div>`;
    loader.style.display = 'flex';
}
function hideLoading() {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = 'none';
}
function showMessage(message, isError = false) {
    const div = document.createElement('div');
    const bgColor = isError ? '#e74c3c' : '#27ae60';
    const borderColor = isError ? '#c0392b' : '#229954';
    const icon = isError ? '⚠️' : '✅';
    div.style.cssText = `background:${bgColor};color:white;padding:15px;border-radius:5px;margin:15px auto;border:1px solid ${borderColor};font-family:'Noto Sans JP',sans-serif;box-shadow:0 4px 8px rgba(0,0,0,0.3);max-width:800px;text-align:center;`;
    div.innerHTML = `${icon} ${message}`;
    const target = document.querySelector('.container') || document.body;
    target.insertBefore(div, target.firstChild);
    setTimeout(() => div.remove(), isError ? 10000 : 5000);
}
const showError = (message) => showMessage(message, true);
const showSuccess = (message) => showMessage(message, false);

// UTF-8対応の暗号化/復号化関数
function simpleEncrypt(text, key = 'jinro2024') {
    try {
        const utf8Bytes = new TextEncoder().encode(text);
        const keyBytes = new TextEncoder().encode(key);
        const encrypted = new Uint8Array(utf8Bytes.length);
        for (let i = 0; i < utf8Bytes.length; i++) encrypted[i] = utf8Bytes[i] ^ keyBytes[i % keyBytes.length];
        let binary = '';
        for (let i = 0; i < encrypted.length; i++) binary += String.fromCharCode(encrypted[i]);
        return btoa(binary);
    } catch (error) { console.error('暗号化エラー:', error); showError('データの暗号化中にエラーが発生しました。'); return null; }
}
function simpleDecrypt(encryptedText, key = 'jinro2024') {
    function isValidBase64(str) {
        if (typeof str !== 'string' || !str.trim()) return false;
        try { return btoa(atob(str)) === str; } catch (e) { return false; }
    }
    if (!isValidBase64(encryptedText)) throw new Error("サーバーから取得したデータが破損しているか、形式が正しくありません。");
    try {
        const binary = atob(encryptedText);
        const encrypted = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) encrypted[i] = binary.charCodeAt(i);
        const keyBytes = new TextEncoder().encode(key);
        const decrypted = new Uint8Array(encrypted.length);
        for (let i = 0; i < decrypted.length; i++) decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
        return new TextDecoder().decode(decrypted);
    } catch (error) { console.error('復号化処理中にエラー:', error); throw new Error('データの復号化に失敗しました。'); }
}

document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.CONFIG || {};
    const currentPage = document.body.id;

    // ====================================================================
    // フッターの動的生成
    // ====================================================================
    const footer = document.querySelector('footer');
    if (footer) {
        const binId = new URLSearchParams(window.location.search).get('bin');
        const nav = document.createElement('nav');
        const links = [
            { href: './player.html', text: '役職確認' },
            { href: './random.html', text: 'ランダムツール' }
        ];

        links.forEach((linkInfo, index) => {
            const link = document.createElement('a');
            const url = new URL(linkInfo.href, window.location.href);
            if (binId) {
                url.searchParams.set('bin', binId);
            }
            link.href = url.toString();
            link.textContent = linkInfo.text;
            nav.appendChild(link);
            if (index < links.length - 1) {
                nav.append(' | ');
            }
        });
        footer.appendChild(nav);
    }

    // ====================================================================
    // index.html (GMツール) の初期化
    // ====================================================================
    if (currentPage === 'gm-tool-page') {
        let rolesData = [];
        let playerAssignments = [];

        const participantsTextarea = document.getElementById('participants');
        const csvFileInput = document.getElementById('csv-file-input');
        const villagerCountInput = document.getElementById('villager-count');
        const werewolfCountInput = document.getElementById('werewolf-count');
        const thirdPartyCountInput = document.getElementById('third-party-count');
        const generateButton = document.getElementById('generate-button');
        const setupArea = document.getElementById('setup-area');
        const resultArea = document.getElementById('result-area');
        const combinedOutput = document.getElementById('combined-output');
        const gmDetailedAssignments = document.getElementById('gm-detailed-assignments');
        const copyAllButton = document.getElementById('copy-all-button');
        const resetButton = document.getElementById('reset-button');
        const gameProgressArea = document.getElementById('game-progress-area');
        const gameDaysInput = document.getElementById('game-days');
        const playerStatusList = document.getElementById('player-status-list');
        const generateProgressButton = document.getElementById('generate-progress-button');
        const progressPreview = document.getElementById('progress-preview');
        const progressOutput = document.getElementById('progress-output');
        const copyProgressButton = document.getElementById('copy-progress-button');
        const teamCountToggle = document.getElementById('team-count-toggle');
        const roleNameToggle = document.getElementById('role-name-toggle');

        const parseCSV = (text) => {
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) return [];
            const headers = lines[0].split(',').map(h => h.trim());
            return lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                return headers.reduce((obj, header, index) => ({ ...obj, [header]: values[index] }), {});
            });
        };

        const loadDefaultCsv = async () => {
            try {
                const response = await fetch('./roles.csv');
                if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);
                const text = await response.text();
                rolesData = parseCSV(text);
                showSuccess(`役職リスト (roles.csv) を読み込みました (${rolesData.length}件)`);
            } catch (error) { console.error('roles.csvの自動読み込みに失敗:', error); showError('roles.csvの自動読み込みに失敗しました。'); }
        };

        csvFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    rolesData = parseCSV(e.target.result);
                    showSuccess(`CSVファイルを読み込みました (${rolesData.length}件)`);
                } catch (error) { console.error('CSV解析エラー:', error); showError('CSVファイルの解析に失敗しました。'); }
            };
            reader.readAsText(file);
        });

        const assignRoles = (participants, roles, counts) => {
            const getRolesByTeam = (team, count) => roles.filter(r => r['陣営'] === team).sort(() => 0.5 - Math.random()).slice(0, count);
            const availableRoles = [
                ...getRolesByTeam('村人陣営', counts.villager),
                ...getRolesByTeam('人狼陣営', counts.werewolf),
                ...getRolesByTeam('第三陣営', counts.thirdParty)
            ];
            const passwords = ['寿司','ラーメン','天ぷら','お好み焼き','たこ焼き','うどん','そば','カレー','とんかつ','焼き鳥','おにぎり','味噌汁','刺身','枝豆','餃子','唐揚げ','焼き魚','すき焼き','しゃぶしゃぶ','おでん','もんじゃ焼き','カツ丼','親子丼','牛丼','うなぎ','とろろ','茶碗蒸し','漬物','納豆','梅干し'].sort(() => 0.5 - Math.random());
            return [...participants].sort(() => 0.5 - Math.random()).map((participant, index) => {
                const role = availableRoles[index];
                return { name: participant, role: role['役職名'], team: role['陣営'], ability: role['能力'], winCondition: role['勝利条件'], author: role['制作者'] || '不明', fortuneResult: role['占い結果'] || (role['陣営'] === '人狼陣営' ? '人狼' : '人狼ではない'), password: passwords[index] || `pass${index+1}` };
            });
        };

        const generateGMDetailedList = (assignments) => {
            gmDetailedAssignments.innerHTML = '';
            const container = document.createElement('div');
            container.className = 'player-card-container';
            assignments.forEach(a => {
                const card = document.createElement('div');
                card.className = 'player-card';
                card.innerHTML = `<div class="player-card-grid"><div><strong>プレイヤー:</strong> ${a.name}</div><div><strong>役職:</strong> ${a.role}</div><div><strong>陣営:</strong> ${a.team}</div><div><strong>合言葉:</strong> ${a.password}</div><div><strong>占い結果:</strong> ${a.fortuneResult}</div><div><strong>制作者:</strong> ${a.author}</div></div><div class="player-card-details"><strong>能力:</strong> ${a.ability}</div><div class="player-card-details"><strong>勝利条件:</strong> ${a.winCondition}</div>`;
                container.appendChild(card);
            });
            gmDetailedAssignments.appendChild(container);
        };

        const setupGameProgressMaker = (assignments) => {
            playerStatusList.innerHTML = '';
            const container = document.createElement('div');
            container.className = 'player-status-list-container';
            assignments.forEach(player => {
                const item = document.createElement('div');
                item.className = 'player-status-item';
                item.innerHTML = `<span class="player-name">${player.name}</span><div class="status-buttons"><button class="status-btn alive selected" data-status="alive">生存</button><button class="status-btn dead" data-status="dead">死亡</button></div>`;
                container.appendChild(item);
            });
            playerStatusList.appendChild(container);
        };

        const displayResults = (assignments, binId) => {
            const playerUrl = new URL('./player.html', window.location.href);
            const randomUrl = new URL('./random.html', window.location.href);
            playerUrl.searchParams.set('bin', binId);
            randomUrl.searchParams.set('bin', binId);

            combinedOutput.value = 
                `プレイヤー確認ページ: ${playerUrl.href}\n` +
                `ランダムツールページ: ${randomUrl.href}\n\n` +
                `各プレイヤーに以下の合言葉を伝えてください:\n` +
                assignments.map(a => `${a.name}: ${a.password}`).join('\n');
            showSuccess('共有URLと合言葉の生成に成功しました！');
        };

        const saveState = (assignments, binId) => {
            const state = { 
                participants: participantsTextarea.value, 
                villagerCount: villagerCountInput.value, 
                werewolfCount: werewolfCountInput.value, 
                thirdPartyCount: thirdPartyCountInput.value, 
                playerAssignments: assignments,
                binId: binId
            };
            sessionStorage.setItem('jinroGameState', JSON.stringify(state));
        };

        const loadSavedState = () => {
            const savedState = sessionStorage.getItem('jinroGameState');
            if (!savedState) return;
            const state = JSON.parse(savedState);
            participantsTextarea.value = state.participants || '';
            villagerCountInput.value = state.villagerCount || '0';
            werewolfCountInput.value = state.werewolfCount || '0';
            thirdPartyCountInput.value = state.thirdPartyCount || '0';
            if (state.playerAssignments && state.playerAssignments.length > 0) {
                playerAssignments = state.playerAssignments;
                generateGMDetailedList(playerAssignments);
                setupGameProgressMaker(playerAssignments);
                displayResults(playerAssignments, state.binId);
                setupArea.style.display = 'none';
                resultArea.style.display = 'block';
                gameProgressArea.style.display = 'block';
                showSuccess('前回の作業状態を復元しました');
            }
        };

        generateButton.addEventListener('click', async () => {
            const participants = participantsTextarea.value.split('\n').map(name => name.trim()).filter(Boolean);
            const counts = { villager: parseInt(villagerCountInput.value), werewolf: parseInt(werewolfCountInput.value), thirdParty: parseInt(thirdPartyCountInput.value) };
            const totalRolesCount = counts.villager + counts.werewolf + counts.thirdParty;
            if (participants.length === 0) return showError('参加者を入力してください。');
            if (rolesData.length === 0) return showError('役職データが読み込まれていません。CSVを読み込んでください。');
            if (participants.length !== totalRolesCount) return showError(`参加者数 (${participants.length}) と役職合計 (${totalRolesCount}) が一致しません。`);
            
            playerAssignments = assignRoles(participants, rolesData, counts);
            
            showLoading('共有URLを生成中...');
            try {
                const encryptedData = simpleEncrypt(JSON.stringify(playerAssignments));
                if (!encryptedData) return;

                if (CONFIG.jsonbinEnabled && CONFIG.jsonbinApiKey) {
                    const storage = new JSONBinStorage(CONFIG.jsonbinApiKey);
                    const newBinId = await storage.save(encryptedData);
                    displayResults(playerAssignments, newBinId);
                    saveState(playerAssignments, newBinId);
                } else {
                    showError("JSONBin.ioのAPIキーが設定されていないため、URL共有機能は利用できません。");
                }
            } catch (e) {
                showError(`URLの生成中にエラーが発生しました: ${e.message}`);
            } finally {
                hideLoading();
            }

            generateGMDetailedList(playerAssignments);
            setupGameProgressMaker(playerAssignments);
            setupArea.style.display = 'none';
            resultArea.style.display = 'block';
            gameProgressArea.style.display = 'block';
        });

        resetButton.addEventListener('click', () => { if (confirm('本当にリセットしますか？')) { sessionStorage.clear(); localStorage.clear(); window.location.reload(); } });
        copyAllButton.addEventListener('click', () => navigator.clipboard.writeText(combinedOutput.value).then(() => showSuccess('共有情報をコピーしました！'), () => showError('コピーに失敗しました。')));
        
        // --- ゲーム進行状況メーカーのイベントリスナー ---
        playerStatusList.addEventListener('click', (e) => {
            if (e.target.classList.contains('status-btn')) {
                const parent = e.target.parentElement;
                parent.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('selected'));
                e.target.classList.add('selected');
            }
        });

        [teamCountToggle, roleNameToggle].forEach(toggle => {
            toggle.addEventListener('click', () => {
                const enabled = toggle.dataset.enabled !== 'true';
                toggle.dataset.enabled = enabled;
                toggle.textContent = enabled ? 'する' : 'しない';
                toggle.classList.toggle('enabled', enabled);
            });
        });

        generateProgressButton.addEventListener('click', () => {
            const days = gameDaysInput.value || '1';
            const includeTeamCount = teamCountToggle.dataset.enabled === 'true';
            const includeRoleName = roleNameToggle.dataset.enabled === 'true';
            const teamCounts = { '村人陣営': 0, '人狼陣営': 0, '第三陣営': 0 };
            const alivePlayers = [], deadPlayers = [];

            document.querySelectorAll('.player-status-item').forEach(item => {
                const playerName = item.querySelector('.player-name').textContent;
                const status = item.querySelector('.status-btn.selected').dataset.status;
                const player = playerAssignments.find(p => p.name === playerName);
                if (player) {
                    const displayName = includeRoleName ? `${playerName}(${player.role})` : playerName;
                    (status === 'alive' ? alivePlayers : deadPlayers).push(displayName);
                    if (status === 'alive') teamCounts[player.team]++;
                }
            });

            let text = `=====${days}日目=====\n`;
            if (includeTeamCount) text += `生存者内訳: 村人 ${teamCounts['村人陣営']}人, 人狼 ${teamCounts['人狼陣営']}人, 第三 ${teamCounts['第三陣営']}人\n=================\n`;
            if (deadPlayers.length > 0) text += `死亡者: ${deadPlayers.join(', ')}\n`;
            if (alivePlayers.length > 0) text += `生存者: ${alivePlayers.join(', ')}\n`;
            progressOutput.value = text.trim();
            progressPreview.style.display = 'block';
        });

        copyProgressButton.addEventListener('click', () => navigator.clipboard.writeText(progressOutput.value).then(() => showSuccess('進行状況をコピーしました！'), () => showError('コピーに失敗しました。')));

        // 初期化処理
        loadDefaultCsv();
        loadSavedState();
    }

    // ====================================================================
    // player.html (役職確認) の初期化
    // ====================================================================
    if (currentPage === 'player-page') {
        const passwordInput = document.getElementById('password-input');
        const revealButton = document.getElementById('reveal-button');
        const resultDisplay = document.getElementById('result-display');
        const inputArea = document.getElementById('input-area');
        let allAssignmentsData = null;

        const loadPlayerData = async () => {
            showLoading('データを読み込み中...');
            try {
                const params = new URLSearchParams(window.location.search);
                const binId = params.get('bin');
                const encryptedData = params.get('data');
                let dataToDecrypt = null;

                if (binId) {
                    if (!CONFIG.jsonbinApiKey) throw new Error('短縮URL機能が無効です。');
                    const storage = new JSONBinStorage(CONFIG.jsonbinApiKey);
                    dataToDecrypt = await storage.load(binId);
                } else if (encryptedData) {
                    dataToDecrypt = decodeURIComponent(encryptedData);
                } else {
                    throw new Error('URLに役職データが含まれていません。');
                }
                const decryptedData = simpleDecrypt(dataToDecrypt);
                allAssignmentsData = JSON.parse(decryptedData);
                showSuccess('役職データを読み込みました。');
            } catch (error) {
                console.error("データ読み込みエラー:", error);
                showError(error.message);
                passwordInput.disabled = true;
                revealButton.disabled = true;
            } finally { hideLoading(); }
        };

        const displayPlayerRole = () => {
            const password = passwordInput.value.trim();
            if (!password) return showError('合言葉を入力してください。');
            if (!allAssignmentsData) return showError('役職データが読み込まれていません。');
            const assignment = allAssignmentsData.find(a => a.password === password);
            if (assignment) {
                document.getElementById('role-output').textContent = assignment.role;
                document.getElementById('team-output').textContent = assignment.team;
                document.getElementById('fortune-result-output').textContent = assignment.fortuneResult;
                document.getElementById('ability-output').textContent = assignment.ability;
                document.getElementById('win-condition-output').textContent = assignment.winCondition;
                document.getElementById('author-output').textContent = assignment.author;
                resultDisplay.style.display = 'block';
                inputArea.style.display = 'none';
                showSuccess(`${assignment.name}さんの役職を表示しました`);
            } else { showError('合言葉が間違っています。'); }
        };

        revealButton.addEventListener('click', displayPlayerRole);
        passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') displayPlayerRole(); });
        loadPlayerData();
    }

    // ====================================================================
    // random.html (ランダムツール) の初期化
    // ====================================================================
    if (currentPage === 'random-tools-page') {
        const playerListInput = document.getElementById('player-list-input');
        const playerSelectionContainer = document.getElementById('player-selection-container');
        const playerSelectionList = document.getElementById('player-selection-list');
        const numToSelectInput = document.getElementById('num-to-select');
        const executeLotteryBtn = document.getElementById('execute-lottery');
        const lotteryResultDiv = document.getElementById('lottery-result');
        const lotteryResultText = document.getElementById('lottery-result-text');
        const probabilityInput = document.getElementById('probability-input');
        const probabilityType = document.getElementById('probability-type');
        const executeCoinTossBtn = document.getElementById('execute-coin-toss');
        const coinTossResultDiv = document.getElementById('coin-toss-result');
        const coinTossResultText = document.getElementById('coin-toss-result-text');

        const updatePlayerSelectionList = () => {
            const players = playerListInput.value.split('\n').map(p => p.trim()).filter(p => p);
            playerSelectionContainer.style.display = players.length > 0 ? 'block' : 'none';
            playerSelectionList.innerHTML = players.map(player => `
                <div style="margin-bottom:5px;">
                    <label style="cursor:pointer;display:flex;align-items:center;">
                        <input type="checkbox" name="player" value="${player}" checked style="width:20px;height:20px;margin-right:10px;">
                        <span>${player}</span>
                    </label>
                </div>`).join('');
        };

        const loadPlayersFromBin = async () => {
            const binId = new URLSearchParams(window.location.search).get('bin');
            if (binId && CONFIG.jsonbinApiKey) {
                showLoading('プレイヤーリストを読み込み中...');
                try {
                    const storage = new JSONBinStorage(CONFIG.jsonbinApiKey);
                    const encryptedData = await storage.load(binId);
                    const assignments = JSON.parse(simpleDecrypt(encryptedData));
                    if (assignments && assignments.length > 0) {
                        playerListInput.value = assignments.map(a => a.name).join('\n');
                        updatePlayerSelectionList();
                        showSuccess('プレイヤーリストをURLから読み込みました。');
                    }
                } catch (error) { console.error('URLからのプレイヤーリスト読み込み失敗:', error); showError(error.message); } 
                finally { hideLoading(); }
            }
        };

        executeLotteryBtn.addEventListener('click', () => {
            const checkedPlayers = Array.from(document.querySelectorAll('input[name="player"]:checked')).map(cb => cb.value);
            const numToSelect = parseInt(numToSelectInput.value, 10);
            lotteryResultDiv.style.display = 'block';
            if (checkedPlayers.length < numToSelect) {
                lotteryResultText.textContent = 'エラー: 選出人数が対象人数を超えています。';
            } else {
                const selected = [...checkedPlayers].sort(() => 0.5 - Math.random()).slice(0, numToSelect);
                lotteryResultText.textContent = selected.join(', ');
            }
        });

        executeCoinTossBtn.addEventListener('click', () => {
            const probValue = probabilityInput.value;
            let probability = 0.5;
            coinTossResultDiv.style.display = 'block';
            try {
                if (probabilityType.value === 'percent') {
                    probability = parseFloat(probValue) / 100;
                } else {
                    const [num, den] = probValue.split('/').map(parseFloat);
                    if (isNaN(num) || isNaN(den) || den === 0) throw new Error("無効な分数です。");
                    probability = num / den;
                }
                if (isNaN(probability) || probability < 0 || probability > 1) throw new Error("確率は0%～100%の範囲で指定してください。");
                const result = Math.random() < probability ? '表' : '裏';
                coinTossResultText.innerHTML = `<span style="font-size:2em;font-weight:bold;color:${result === '表' ? '#2ecc71' : '#f1c40f'};">${result}</span>`;
            } catch (error) { coinTossResultText.textContent = `エラー: ${error.message}`; }
        });

        playerListInput.addEventListener('input', updatePlayerSelectionList);
        loadPlayersFromBin();
    }
});