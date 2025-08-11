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

// 改良されたCSV解析関数（改行対応）


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
        let rolesData = { villager: [], werewolf: [], thirdParty: [] };
        let playerAssignments = [];

        const participantsTextarea = document.getElementById('participants');
        // 新しいUI要素の取得
        const fortuneTellerCountInput = document.getElementById('fortune-teller-count');
        const mediumCountInput = document.getElementById('medium-count');
        const knightCountInput = document.getElementById('knight-count');
        const villagerCountInput = document.getElementById('villager-count');
        const werewolfCountInput = document.getElementById('werewolf-count');
        const madmanCountInput = document.getElementById('madman-count');
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

        const loadAllJsons = async () => {
            const files = ['villager-roles.json', 'murder-roles.json', '3rd-roles.json'];
            showLoading('役職データを読み込み中...');
            try {
                const results = await Promise.all(files.map(async file => {
                    const response = await fetch(file);
                    if (!response.ok) throw new Error(`${file}の読み込みに失敗しました。`);
                    return await response.json();
                }));

                rolesData = results.flat();
                console.log('すべての役職データを読み込みました:', rolesData);
                showSuccess(`役職リストを読み込みました (${rolesData.length}件)`);

            } catch (error) {
                console.error('JSONの読み込みに失敗:', error);
                showError(error.message);
            } finally {
                hideLoading();
            }
        };

        const assignRoles = (participants, allRoles, counts) => {
            console.log('役職割り当て開始:', { participants, counts });

            // カテゴリに基づいて役職を取得する内部関数
            const getRolesByCategory = (team, category, count) => {
                const filteredRoles = allRoles.filter(r => r && r['陣営'] === team && r['分類'] === category);
                if (filteredRoles.length < count) {
                    throw new Error(`${team}の${category}役職が不足しています。必要: ${count}件, 利用可能: ${filteredRoles.length}件`);
                }
                return filteredRoles.sort(() => 0.5 - Math.random()).slice(0, count);
            };

            // 第三陣営の役職を取得する関数
            const getThirdPartyRoles = (count) => {
                const teamRoles = allRoles.filter(r => r && r['陣営'] === '第三陣営');
                if (teamRoles.length < count) {
                    throw new Error(`第三陣営の役職が不足しています。必要: ${count}件, 利用可能: ${teamRoles.length}件`);
                }
                return teamRoles.sort(() => 0.5 - Math.random()).slice(0, count);
            };

            try {
                // 1. 初期抽選
                let initialRoles = [
                    ...getRolesByCategory('村人陣営', '占い師系', counts.fortuneTeller),
                    ...getRolesByCategory('村人陣営', '霊媒師系', counts.medium),
                    ...getRolesByCategory('村人陣営', '騎士系', counts.knight),
                    ...getRolesByCategory('村人陣営', '一般', counts.villager),
                    ...getRolesByCategory('人狼陣営', '人狼', counts.werewolf),
                    ...getRolesByCategory('人狼陣営', '狂人', counts.madman),
                    ...getThirdPartyRoles(counts.thirdParty)
                ];

                // 2. 関連役職の処理
                const relatedRolesToAdd = [];
                const rolesToRemove = new Set();
                let generalVillagers = initialRoles.filter(r => r['分類'] === '一般');

                initialRoles.forEach(role => {
                    const relatedRoleName = role['関連役職'];
                    const relatedRoleCount = parseInt(role['関連役職人数'], 10);

                    if (relatedRoleName && relatedRoleCount > 0) {
                        const relatedRole = allRoles.find(r => r['役職名'] === relatedRoleName);
                        if (relatedRole) {
                            for (let i = 0; i < relatedRoleCount; i++) {
                                relatedRolesToAdd.push(relatedRole);
                                // 代わりに一般村人を削除
                                if (generalVillagers.length > 0) {
                                    const toRemove = generalVillagers.pop();
                                    rolesToRemove.add(toRemove);
                                } else {
                                    // 削除する一般村人がいない場合、エラーまたは代替策
                                    console.warn('関連役職を追加するための空きがありません。');
                                }
                            }
                        }
                    }
                });

                // 削除対象を除外し、関連役職を追加
                let finalRoles = initialRoles.filter(r => !rolesToRemove.has(r));
                finalRoles.push(...relatedRolesToAdd);

                // 最終的な人数チェック
                if (finalRoles.length !== participants.length) {
                    throw new Error(`最終的な役職数(${finalRoles.length})が参加者数(${participants.length})と一致しません。関連役職の設定を確認してください。`);
                }

                console.log('最終的に選択された役職:', finalRoles);

                const passwords = ['寿司','ラーメン','天ぷら','お好み焼き','たこ焼き','うどん','そば','カレー','とんかつ','焼き鳥','おにぎり','味噌汁','刺身','枝豆','餃子','唐揚げ','焼き魚','すき焼き','しゃぶしゃぶ','おでん','もんじゃ焼き','カツ丼','親子丼','牛丼','うなぎ','とろろ','茶碗蒸し','漬物','納豆','梅干し'].sort(() => 0.5 - Math.random());
                
                return [...participants].sort(() => 0.5 - Math.random()).map((participant, index) => {
                    const role = finalRoles[index];
                    if (!role) {
                        throw new Error(`参加者 ${participant} に割り当てる役職がありません。`);
                    }
                    // 元の役職オブジェクトをコピーし、プレイヤー名とパスワードを追加する
                    const assignment = { ...role };
                    assignment.name = participant;
                    assignment.password = passwords[index] || `pass${index+1}`;
                    return assignment;
                });
            } catch (error) {
                console.error('役職割り当てエラー:', error);
                throw error;
            }
        };

const generateGMDetailedList = (assignments) => {
    gmDetailedAssignments.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'player-card-container';
    assignments.forEach(a => {
        const card = document.createElement('div');
        card.className = 'player-card';
        
        const abilityHtml = (a['能力'] || '説明なし').replace(/\n/g, '<br>');
        const winConditionHtml = (a['勝利条件'] || '説明なし').replace(/\n/g, '<br>');
        const fortuneResult = a['占い結果'] || (a['陣営'] === '人狼陣営' && a['分類'] === '人狼' ? '人狼' : '人狼ではない');

        let relatedRoleHtml = '';
        if (a['関連役職']) {
            relatedRoleHtml = `
                <div><strong>関連役職:</strong> ${a['関連役職']}</div>
                <div><strong>関連人数:</strong> ${a['関連役職人数']}</div>
            `;
        }

        card.innerHTML = `
            <div class="player-card-grid">
                <div><strong>プレイヤー:</strong> ${a.name}</div>
                <div><strong>役職:</strong> ${a['役職名']}</div>
                <div><strong>陣営:</strong> ${a['陣営']}</div>
                <div><strong>合言葉:</strong> ${a.password}</div>
                <div><strong>占い結果:</strong> ${fortuneResult}</div>
                <div><strong>制作者:</strong> ${a['制作者']}</div>
                ${relatedRoleHtml}
            </div>
            <div class="player-card-details">
                <strong>能力:</strong> ${abilityHtml}
            </div>
            <div class="player-card-details">
                <strong>勝利条件:</strong> ${winConditionHtml}
            </div>
        `;
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
            const counts = {
                fortuneTeller: parseInt(fortuneTellerCountInput.value, 10) || 0,
                medium: parseInt(mediumCountInput.value, 10) || 0,
                knight: parseInt(knightCountInput.value, 10) || 0,
                villager: parseInt(villagerCountInput.value, 10) || 0,
                werewolf: parseInt(werewolfCountInput.value, 10) || 0,
                madman: parseInt(madmanCountInput.value, 10) || 0,
                thirdParty: parseInt(thirdPartyCountInput.value, 10) || 0,
            };
            const totalRolesCount = Object.values(counts).reduce((sum, count) => sum + count, 0);

            if (participants.length === 0) return showError('参加者を入力してください。');
            if (rolesData.length === 0) return showError('役職データが読み込まれていません。ページをリロードしてみてください。');
            if (participants.length !== totalRolesCount) return showError(`参加者数 (${participants.length}) と役職合計 (${totalRolesCount}) が一致しません。`);

            if (counts.fortuneTeller === 0) {
                if (!confirm('占い師が0人ですが、本当にこの設定で役職を抽選しますか？')) {
                    return;
                }
            }

            try {
                playerAssignments = assignRoles(participants, rolesData, counts);
                
                showLoading('共有URLを生成中...');
                try {
                    const encryptedData = simpleEncrypt(JSON.stringify(playerAssignments));
                    if (!encryptedData) return;

                    if (CONFIG.jsonbinEnabled && CONFIG.jsonbinApiKey) {
                        const storage = new JSONBinStorage(CONFIG.jsonbinApiKey);
                        const newBinId = await storage.save(encryptedData);
                        displayResults(playerAssignments, newBinId);
                        // saveState(playerAssignments, newBinId); // TODO: saveStateを新しいcountsに対応させる
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
            } catch (error) {
                showError(`役職割り当て中にエラーが発生しました: ${error.message}`);
            }
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
        loadAllJsons();
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
        const fortuneResult = assignment['占い結果'] || (assignment['陣営'] === '人狼陣営' && assignment['分類'] === '人狼' ? '人狼' : '人狼ではない');

        document.getElementById('role-output').textContent = assignment['役職名'];
        document.getElementById('team-output').textContent = assignment['陣営'];
        document.getElementById('fortune-result-output').textContent = fortuneResult;
        document.getElementById('ability-output').innerHTML = (assignment['能力'] || '説明なし').replace(/\n/g, '<br>');
        document.getElementById('win-condition-output').innerHTML = (assignment['勝利条件'] || '説明なし').replace(/\n/g, '<br>');
        document.getElementById('author-output').textContent = assignment['制作者'] || '不明';
        resultDisplay.style.display = 'block';
        inputArea.style.display = 'none';
        showSuccess(`${assignment.name}さんの役職を表示しました`);
    } else { 
        showError('合言葉が間違っています。'); 
    }
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