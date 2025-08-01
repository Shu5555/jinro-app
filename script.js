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
    const fortuneResultOutput = document.getElementById('fortune-result-output');
    const authorOutput = document.getElementById('author-output');

    let rolesData = [];
    let playerAssignments = [];
    let allAssignmentsData = null; // player.html用

    const JAPANESE_FOOD_PASSWORDS = [
        '寿司', 'ラーメン', '天ぷら', 'お好み焼き', 'たこ焼き', 'うどん', 'そば', 'カレー', 'とんかつ', '焼き鳥',
        'おにぎり', '味噌汁', '刺身', '枝豆', '餃子', '唐揚げ', '焼き魚', 'すき焼き', 'しゃぶしゃぶ', 'おでん',
        'もんじゃ焼き', 'カツ丼', '親子丼', '牛丼', 'うなぎ', 'とろろ', '茶碗蒸し', '漬物', '納豆', '梅干し'
    ];

    // ====================================================================
    // index.html (GMツール) 関連の処理
    // ====================================================================
    if (generateButton) {
        loadDefaultCsv();
        loadSavedState();

        async function loadDefaultCsv() {
            try {
                const response = await fetch('./roles.csv');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const text = await response.text();
                rolesData = parseCSV(text);
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
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
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
            if (rolesData.length === 0) return alert('役職データが読み込まれていません。');
            if (participants.length !== totalRolesCount) {
                return alert(`参加者の数 (${participants.length}人) と役職の合計人数 (${totalRolesCount}人) が一致しません。`);
            }

            playerAssignments = assignRoles(participants, rolesData, { villager: villagerCount, werewolf: werewolfCount, thirdParty: thirdPartyCount });
            displayResults(playerAssignments);
            saveState();
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
                    fortuneResult: role['占い結果'] || (role['陣営'] === '人狼陣営' ? '人狼' : '人狼ではない'),
                    password: generateUniquePassword()
                }
            });
        }

        function displayResults(assignments) {
            const data = encodeURIComponent(JSON.stringify(assignments));
            const baseUrl = window.location.origin + window.location.pathname.replace(/[^\/]*$/, 'player.html');
            const shareUrl = `${baseUrl}?data=${data}`;

            combinedOutput.value = `共有URL: ${shareUrl}\n\n` +
                `各プレイヤーに以下の合言葉を伝えてください:\n` +
                assignments.map(a => `${a.name}: ${a.password}`).join('\n');

            // GM確認用リストをHTMLで生成
            const gmList = document.createElement('ul');
            gmList.style.listStyleType = 'none';
            gmList.style.padding = '0';

            assignments.forEach(a => {
                const listItem = document.createElement('li');
                listItem.style.marginBottom = '15px';
                listItem.style.padding = '10px';
                listItem.style.border = '1px solid #95a5a6'; // 枠線の色を修正
                listItem.style.borderRadius = '5px';
                listItem.style.backgroundColor = '#2c3e50';
                listItem.style.color = '#ecf0f1';

                listItem.innerHTML = 
                    `<strong>プレイヤー:</strong> ${a.name}<br>` +
                    `<strong>役職:</strong> ${a.role} (${a.team})<br>` +
                    `<strong>合言葉:</strong> ${a.password}<br>` +
                    `<strong>占い結果:</strong> ${a.fortuneResult}<br>` +
                    `<strong>能力:</strong> ${a.ability || 'なし'}<br>` +
                    `<strong>勝利条件:</strong> ${a.winCondition || 'なし'}<br>` +
                    `<strong>制作者:</strong> ${a.author || '不明'}`;
                
                gmList.appendChild(listItem);
            });

            gmDetailedAssignments.innerHTML = ''; // 中身をクリア
            gmDetailedAssignments.appendChild(gmList);
        }

        copyAllButton.addEventListener('click', () => {
            navigator.clipboard.writeText(combinedOutput.value).then(() => alert('共有情報をコピーしました！'));
        });

        resetButton.addEventListener('click', () => {
            if (confirm('本当にリセットしますか？')) {
                sessionStorage.clear();
                window.location.reload();
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
                allAssignmentsData = JSON.parse(decodeURIComponent(data));
            } else {
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
                authorOutput.textContent = assignment.author || '不明';
                playerResultDisplay.style.display = 'block';
            } else {
                alert('合言葉が間違っています。');
                playerResultDisplay.style.display = 'none';
            }
        });
    }
});