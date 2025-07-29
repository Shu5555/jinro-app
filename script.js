document.addEventListener('DOMContentLoaded', () => {
    // index.html の要素
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

    // player.html の要素 (DOMContentLoaded イベントリスナー内で条件分岐して取得)
    const passwordInput = document.getElementById('password-input');
    const revealButton = document.getElementById('reveal-button');
    const playerResultDisplay = document.getElementById('result-display');
    const roleOutput = document.getElementById('role-output');
    const teamOutput = document.getElementById('team-output');
    const abilityOutput = document.getElementById('ability-output');
    const winConditionOutput = document.getElementById('win-condition-output');

    let rolesData = []; // CSVから読み込んだ役職データを格納
    let playerAssignments = []; // プレイヤーへの役職割り当て結果を格納

    // 日本語の食べ物の合言葉リスト
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
    if (generateButton) { // generateButton が存在する場合、index.html の処理
        // ページ読み込み時にroles.csvを自動で読み込む
        loadDefaultCsv();
        // ページ読み込み時に保存された状態を復元
        loadSavedState();

        async function loadDefaultCsv() {
            try {
                const response = await fetch('roles.csv');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const text = await response.text();
                rolesData = parseCSV(text);
                console.log('roles.csvを自動で読み込みました。', rolesData);
                alert('roles.csvを自動で読み込みました。');
            } catch (error) {
                console.error('roles.csvの自動読み込みに失敗しました:', error);
                alert('roles.csvの自動読み込みに失敗しました。手動で選択してください。');
            }
        }

        function loadSavedState() {
            const savedParticipants = localStorage.getItem('savedParticipants');
            const savedVillagerCount = localStorage.getItem('savedVillagerCount');
            const savedWerewolfCount = localStorage.getItem('savedWerewolfCount');
            const savedThirdPartyCount = localStorage.getItem('savedThirdPartyCount');
            const savedPlayerAssignments = localStorage.getItem('playerAssignments');

            if (savedParticipants) {
                participantsTextarea.value = savedParticipants;
            }
            if (savedVillagerCount) {
                villagerCountInput.value = savedVillagerCount;
            }
            if (savedWerewolfCount) {
                werewolfCountInput.value = savedWerewolfCount;
            }
            if (savedThirdPartyCount) {
                thirdPartyCountInput.value = savedThirdPartyCount;
            }
            if (savedPlayerAssignments) {
                playerAssignments = JSON.parse(savedPlayerAssignments);
                displayResults(playerAssignments);
                setupArea.style.display = 'none';
                resultArea.style.display = 'block';
            }
        }

        // CSVファイル読み込み (手動)
        csvFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const text = e.target.result;
                    rolesData = parseCSV(text);
                    alert(`CSVファイルが読み込まれました。${rolesData.length}個の役職が登録されました。`);
                    console.log('Parsed Roles Data:', rolesData);
                };
                reader.readAsText(file);
            }
        });

        // CSVパース関数
        function parseCSV(text) {
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headers = lines[0].split(',');
            const roles = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                if (values.length === headers.length) {
                    const role = {};
                    headers.forEach((header, index) => {
                        role[header.trim()] = values[index].trim();
                    });
                    roles.push(role);
                }
            }
            return roles;
        }

        // 役職抽選ボタン
        generateButton.addEventListener('click', () => {
            const participants = participantsTextarea.value.split('\n').map(name => name.trim()).filter(name => name !== '');
            const villagerCount = parseInt(villagerCountInput.value);
            const werewolfCount = parseInt(werewolfCountInput.value);
            const thirdPartyCount = parseInt(thirdPartyCountInput.value);

            const totalRolesCount = villagerCount + werewolfCount + thirdPartyCount;

            if (participants.length === 0) {
                alert('参加者を入力してください。');
                return;
            }
            if (rolesData.length === 0) {
                alert('役職CSVファイルを読み込んでください。');
                return;
            }
            if (participants.length !== totalRolesCount) {
                alert(`参加者の数 (${participants.length}人) と役職の合計人数 (${totalRolesCount}人) が一致しません。`);
                return;
            }

            // 役職割り当てロジック
            playerAssignments = assignRoles(participants, rolesData, { villager: villagerCount, werewolf: werewolfCount, thirdParty: thirdPartyCount });
            
            // 結果表示
            displayResults(playerAssignments);

            // localStorage に保存
            localStorage.setItem('savedParticipants', participantsTextarea.value);
            localStorage.setItem('savedVillagerCount', villagerCountInput.value);
            localStorage.setItem('savedWerewolfCount', werewolfCountInput.value);
            localStorage.setItem('savedThirdPartyCount', thirdPartyCountInput.value);
            localStorage.setItem('playerAssignments', JSON.stringify(playerAssignments));

            setupArea.style.display = 'none';
            resultArea.style.display = 'block';
        });

        // 役職割り当て関数
        function assignRoles(participants, rolesData, counts) {
            const assignments = [];
            let availableRoles = [];

            // 各陣営から必要な数の役職をランダムに選択
            const getRolesByTeam = (teamName, count) => {
                const rolesInTeam = rolesData.filter(role => role['陣営'] === teamName);
                if (rolesInTeam.length < count) {
                    console.warn(`Warning: Not enough roles for ${teamName}. Requested: ${count}, Available: ${rolesInTeam.length}`);
                    // 足りない場合は利用可能な役職をすべて追加し、残りは仮の役職で埋める
                    const tempRoles = Array(count - rolesInTeam.length).fill({ '役職名': `仮の${teamName}役職`, '陣営': teamName, '能力': '', '勝利条件': '' });
                    return [...rolesInTeam, ...tempRoles];
                }
                // ランダムに選択
                return [...rolesInTeam].sort(() => Math.random() - 0.5).slice(0, count);
            };

            availableRoles = [
                ...getRolesByTeam('村人陣営', counts.villager),
                ...getRolesByTeam('人狼陣営', counts.werewolf),
                ...getRolesByTeam('第三陣営', counts.thirdParty)
            ];

            // 参加者と役職をシャッフル
            const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
            const shuffledRoles = [...availableRoles].sort(() => Math.random() - 0.5);

            // 使用済みの合言葉を追跡するためのセット
            const usedPasswords = new Set();

            shuffledParticipants.forEach((participant, index) => {
                const assignedRole = shuffledRoles[index];
                let password = generatePassword();
                // 合言葉が重複しないように再生成
                while (usedPasswords.has(password)) {
                    password = generatePassword();
                }
                usedPasswords.add(password);

                assignments.push({
                    name: participant,
                    role: assignedRole['役職名'],
                    team: assignedRole['陣営'],
                    ability: assignedRole['能力'],
                    winCondition: assignedRole['勝利条件'],
                    password: password
                });
            });
            return assignments;
        }

        // 合言葉生成関数 (日本語の食べ物)
        function generatePassword() {
            const randomIndex = Math.floor(Math.random() * JAPANESE_FOOD_PASSWORDS.length);
            return JAPANESE_FOOD_PASSWORDS[randomIndex];
        }

        // 結果表示関数
        function displayResults(assignments) {
            const baseUrl = window.location.origin + '/player.html';
            let combinedOutputText = `共有URL: ${baseUrl}\n\n`; // 共通URLを一行目に
            let gmDetailedAssignmentsText = '';

            assignments.forEach(assignment => {
                combinedOutputText += `${assignment.name}: ${assignment.password}\n`; // 各プレイヤーの名前と合言葉のみ
                gmDetailedAssignmentsText += `${assignment.name}: ${assignment.role} (${assignment.team})\n  能力: ${assignment.ability || 'なし'}\n  勝利条件: ${assignment.winCondition || 'なし'}\n\n`;
            });

            combinedOutput.value = combinedOutputText;
            gmDetailedAssignments.innerHTML = gmDetailedAssignmentsText;
        }

        // すべてコピーボタン
        copyAllButton.addEventListener('click', () => {
            combinedOutput.select();
            document.execCommand('copy');
            alert('共有情報をコピーしました！');
        });

        // リセットボタン
        resetButton.addEventListener('click', () => {
            participantsTextarea.value = '';
            csvFileInput.value = ''; // ファイル選択をクリア
            villagerCountInput.value = '0';
            werewolfCountInput.value = '0';
            thirdPartyCountInput.value = '0';
            rolesData = [];
            playerAssignments = [];
            localStorage.removeItem('playerAssignments'); // localStorage もクリア

            resultArea.style.display = 'none';
            setupArea.style.display = 'block';
            combinedOutput.value = '';
            gmDetailedAssignments.innerHTML = '';
        });
    } 
    // ====================================================================
    // player.html (役職確認ツール) 関連の処理
    // ====================================================================
    else if (revealButton) { // revealButton が存在する場合、player.html の処理
        // 役職表示ロジックを関数として抽出
        function revealRole(passwordToUse) {
            const storedAssignments = JSON.parse(localStorage.getItem('playerAssignments') || '[]');
            const assignment = storedAssignments.find(assign => assign.password === passwordToUse);

            if (assignment) {
                roleOutput.textContent = assignment.role;
                teamOutput.textContent = assignment.team;
                abilityOutput.textContent = assignment.ability || 'なし';
                winConditionOutput.textContent = assignment.winCondition || 'なし';
                playerResultDisplay.style.display = 'block';
            } else {
                alert('合言葉が間違っています。');
                playerResultDisplay.style.display = 'none';
            }
        }

        // URLから合言葉を取得
        const urlParams = new URLSearchParams(window.location.search);
        const urlPassword = urlParams.get('password');

        if (urlPassword) {
            const decodedUrlPassword = decodeURIComponent(urlPassword); // URLエンコードされた日本語をデコード
            passwordInput.value = decodedUrlPassword; // 入力欄にセット
            revealRole(decodedUrlPassword); // 自動的に役職表示ロジックを実行
        }

        // 手動入力ボタンのイベントリスナーは常に設定
        revealButton.addEventListener('click', () => {
            const enteredPassword = passwordInput.value.trim(); // 日本語なのでtoUpperCase()は不要
            revealRole(enteredPassword);
        });
    }
});