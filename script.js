document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
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
    const passwordInput = document.getElementById('password-input');
    const revealButton = document.getElementById('reveal-button');
    const playerResultDisplay = document.getElementById('result-display');
    const roleOutput = document.getElementById('role-output');
    const teamOutput = document.getElementById('team-output');
    const abilityOutput = document.getElementById('ability-output');
    const winConditionOutput = document.getElementById('win-condition-output');
    const fortuneResultOutput = document.getElementById('fortune-result-output'); // player.htmlの占い結果表示用
    const authorOutput = document.getElementById('author-output'); // player.htmlの制作者表示用

    let rolesData = [];
    let playerAssignments = [];
    let allAssignmentsData = null; // player.html用

    const JAPANESE_FOOD_PASSWORDS = [
        '寿司', 'ラーメン', '天ぷら', 'お好み焼き', 'たこ焼き', 'うどん', 'そば', 'カレー', 'とんかつ', '焼き鳥',
        'おにぎり', '味噌汁', '刺身', '枝豆', '餃子', '唐揚げ', '焼き魚', 'すき焼き', 'しゃぶしゃぶ', 'おでん',
        'もんじゃ焼き', 'カツ丼', '親子丼', '牛丼', 'うなぎ', 'とろろ', '茶碗蒸し', '漬物', '納豆', '梅干し',
        'わさび', '生姜', '豆腐', 'こんにゃく', 'しいたけ', 'えのき', 'まいたけ', 'ごぼう', '大根', '白菜',
        'ねぎ', 'ほうれん草', '小松菜', 'なす', 'ピーマン', 'きゅうり', 'トマト', 'じゃがいも', '玉ねぎ', 'にんじん'
    ];

    // ====================================================================
    // index.html (GMツール) 関連の処理
    // ====================================================================
    if (generateButton) {
        loadDefaultCsv();
        // ページ読み込み時にセッションストレージから状態を復元
        loadSavedState();

        async function loadDefaultCsv() {
            try {
                const response = await fetch('./roles.csv');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const text = await response.text();
                rolesData = parseCSV(text);
                console.log('roles.csvを自動で読み込みました。', rolesData);
            } catch (error) {
                console.error('roles.csvの自動読み込みに失敗しました:', error);
                alert('roles.csvの自動読み込みに失敗しました。手動で選択してください。');
            }
        }

        function saveState() {
            const state = {
                participants: participantsTextarea.value,
                villagerCount: villagerCountInput.value,
                werewolfCount: werewolfCountInput.value,
                thirdPartyCount: thirdPartyCountInput.value,
                playerAssignments: playerAssignments,
            };
            sessionStorage.setItem('jinroGameState', JSON.stringify(state));
        }

        function loadSavedState() {
            const savedState = sessionStorage.getItem('jinroGameState');
            if (savedState) {
                const state = JSON.parse(savedState);
                participantsTextarea.value = state.participants || '';
                villagerCountInput.value = state.villagerCount || '0';
                werewolfCountInput.value = state.werewolfCount || '0';
                thirdPartyCountInput.value = state.thirdPartyCount || '0';
                if (state.playerAssignments && state.playerAssignments.length > 0) {
                    playerAssignments = state.playerAssignments;
                    displayResults(playerAssignments);
                    setupArea.style.display = 'none';
                    resultArea.style.display = 'block';
                }
            }
        }

        if (csvFileInput) {
            csvFileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    rolesData = parseCSV(e.target.result);
                    alert(`CSVファイルが読み込まれました。${rolesData.length}個の役職が登録されました。`);
                };
                reader.readAsText(file);
            });
        }

        function parseCSV(text) {
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) return [];
            const headers = lines[0].split(',').map(h => h.trim());
            return lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '')); // クォーテーションを削除
                const role = {};
                headers.forEach((header, index) => {
                    role[header] = values[index];
                });
                return role;
            });
        }

        generateButton.addEventListener('click', () => {
            const participants = participantsTextarea.value.split('\n').map(name => name.trim()).filter(Boolean);
            const villagerCount = parseInt(villagerCountInput.value) || 0;
            const werewolfCount = parseInt(werewolfCountInput.value) || 0;
            const thirdPartyCount = parseInt(thirdPartyCountInput.value) || 0;
            const totalRolesCount = villagerCount + werewolfCount + thirdPartyCount;

            if (participants.length === 0) return alert('参加者を入力してください。');
            if (rolesData.length === 0) return alert('役職データが読み込まれていません。CSVを確認してください。');
            if (participants.length !== totalRolesCount) {
                return alert(`参加者の数 (${participants.length}人) と役職の合計人数 (${totalRolesCount}人) が一致しません。`);
            }

            playerAssignments = assignRoles(participants, rolesData, { villager: villagerCount, werewolf: werewolfCount, thirdParty: thirdPartyCount });
            displayResults(playerAssignments);
            saveState(); // sessionStorageに状態を保存
            setupArea.style.display = 'none';
            resultArea.style.display = 'block';
        });

        function assignRoles(participants, roles, counts) {
            const getRolesByTeam = (teamName, count) => {
                const teamRoles = roles.filter(role => role['陣営'] === teamName);
                return [...teamRoles].sort(() => 0.5 - Math.random()).slice(0, count);
            };
            const availableRoles = [
                ...getRolesByTeam('村人陣営', counts.villager),
                ...getRolesByTeam('人狼陣営', counts.werewolf),
                ...getRolesByTeam('第三陣営', counts.thirdParty)
            ];
            const shuffledParticipants = [...participants].sort(() => 0.5 - Math.random());
            const usedPasswords = new Set();
            const generateUniquePassword = () => {
                let password;
                do {
                    password = JAPANESE_FOOD_PASSWORDS[Math.floor(Math.random() * JAPANESE_FOOD_PASSWORDS.length)];
                } while (usedPasswords.has(password));
                usedPasswords.add(password);
                return password;
            };
            return shuffledParticipants.map((participant, index) => {
                const role = availableRoles[index];
                return {
                    name: participant,
                    role: role['役職名'],
                    team: role['陣営'],
                    ability: role['能力'],
                    winCondition: role['勝利条件'],
                    author: role['制作者'] || '不明',
                    // CSVに「占い結果」列があればそれを使い、なければ陣営から判断する
                    fortuneResult: role['占い結果'] || (role['陣営'] === '人狼陣営' ? '人狼' : '人狼ではない'),
                    password: generateUniquePassword()
                }
            });
        }

        function displayResults(assignments) {
            // 全プレイヤーの役職情報をエンコードしてURLに含める
            const data = encodeURIComponent(JSON.stringify(assignments));
            const baseUrl = window.location.origin + window.location.pathname.replace(/[^\/]*$/, 'player.html');
            const shareUrl = `${baseUrl}?data=${data}`;

            combinedOutput.value = `共有URL: ${shareUrl}\n\n` +
                `各プレイヤーに以下の合言葉を伝えてください:\n` +
                assignments.map(a => `${a.name}: ${a.password}`).join('\n');

            gmDetailedAssignments.innerText = 'GM確認用: 割り当て詳細一覧\n\n' +
                assignments.map(a =>
                    `プレイヤー: ${a.name}\n` +
                    `役職: ${a.role} (${a.team})\n` +
                    `合言葉: ${a.password}\n` +
                    `占い結果: ${a.fortuneResult}\n` +
                    `能力: ${a.ability || 'なし'}\n` +
                    `勝利条件: ${a.winCondition || 'なし'}\n` +
                    `制作者: ${a.author || '不明'}`
                ).join('\n\n');
        }

        copyAllButton.addEventListener('click', () => {
            if (!combinedOutput.value) return;
            navigator.clipboard.writeText(combinedOutput.value)
                .then(() => alert('共有情報をコピーしました！'))
                .catch(err => {
                    console.error('コピーに失敗しました: ', err);
                    alert('コピーに失敗しました。手動でコピーしてください。');
                });
        });

        resetButton.addEventListener('click', () => {
            if (confirm('本当にリセットしますか？入力内容と結果がすべてクリアされます。')) {
                participantsTextarea.value = '';
                csvFileInput.value = '';
                villagerCountInput.value = '0';
                werewolfCountInput.value = '0';
                thirdPartyCountInput.value = '0';
                playerAssignments = [];
                sessionStorage.removeItem('jinroGameState');
                resultArea.style.display = 'none';
                setupArea.style.display = 'block';
                combinedOutput.value = '';
                gmDetailedAssignments.innerText = '';
                loadDefaultCsv(); // 役職データを再読み込み
            }
        });
    }

    // ====================================================================
    // player.html (役職確認ツール) 関連の処理
    // ====================================================================
    else if (revealButton) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const data = urlParams.get('data');
            if (data) {
                // デコード処理
                allAssignmentsData = JSON.parse(decodeURIComponent(data));
            } else {
                 // データがない場合、入力エリアを無効化
                document.getElementById('password-input').placeholder = "有効なURLではありません";
                document.getElementById('password-input').disabled = true;
                revealButton.disabled = true;
            }
        } catch (e) {
            console.error("役職データの読み込みに失敗しました:", e);
            alert("役職データの読み込みに失敗しました。URLが正しいか確認してください。");
            revealButton.disabled = true;
        }

        revealButton.addEventListener('click', () => {
            const enteredPassword = passwordInput.value.trim();
            if (!enteredPassword) return alert('合言葉を入力してください。');
            if (!allAssignmentsData) return alert('役職データが読み込まれていません。');

            const assignment = allAssignmentsData.find(a => a.password === enteredPassword);

            if (assignment) {
                roleOutput.textContent = assignment.role;
                teamOutput.textContent = assignment.team;
                fortuneResultOutput.textContent = assignment.fortuneResult || '未設定';
                abilityOutput.textContent = assignment.ability || 'なし';
                winConditionOutput.textContent = assignment.winCondition || 'なし';
                authorOutput.textContent = assignment.author || '不明'; // 制作者情報を表示
                playerResultDisplay.style.display = 'block';
            } else {
                alert('合言葉が間違っています。');
                playerResultDisplay.style.display = 'none';
            }
        });
    }
});