// --- 合言葉の単語リスト --- //
const PASSWORD_WORDS = [
    'りんご', 'みかん', 'バナナ', 'いちご', 'ぶどう', 'さくらんぼ', 'もも', 'すいか',
    'めろん', 'れもん', 'ぱいなっぷる', 'なし', 'かき', 'きうい', 'びわ', 'あんず',
    'いぬ', 'ねこ', 'うさぎ', 'ぱんだ', 'きりん', 'ぞう', 'らいおん', 'とら',
    'さる', 'ひつじ', 'うま', 'しか', 'くま', 'りす', 'ハムスター', 'ぺんぎん',
    'はる', 'なつ', 'あき', 'ふゆ', 'そら', 'くも', 'たいよう', 'つき',
    'ほし', 'かぜ', 'あめ', 'ゆき', 'やま', 'かわ', 'うみ', 'もり'
];

// --- 共通の処理 --- //

// Base64を使った簡易的な暗号化・復号
// 実際の暗号化とは異なり、あくまで難読化レベルですが、今回の用途では十分です。
function simpleEncrypt(text) {
    try {
        const textStr = JSON.stringify(text);
        return btoa(encodeURIComponent(textStr));
    } catch (e) {
        console.error("暗号化に失敗しました", e);
        return null;
    }
}

function simpleDecrypt(encryptedText) {
    try {
        const decodedStr = decodeURIComponent(atob(encryptedText));
        return JSON.parse(decodedStr);
    } catch (e) {
        console.error("復号に失敗しました", e);
        return null;
    }
}

// --- ページの初期化処理 --- //

document.addEventListener('DOMContentLoaded', () => {
    // GMページ（index.html）用の処理
    if (document.getElementById('generate-button')) {
        initializeGmPage();
    }

    // プレイヤーページ（player.html）用の処理
    if (document.getElementById('reveal-button')) {
        initializePlayerPage();
    }
});

// --- GMページのロジック --- //

function initializeGmPage() {
    const generateButton = document.getElementById('generate-button');
    const csvFileInput = document.getElementById('csv-file-input');

    // ページ読み込み時にroles.csvを自動で読み込む試み
    fetch('roles.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error('roles.csvが見つかりません。手動でファイルを選択してください。');
            }
            return response.text();
        })
        .then(csvText => {
            parseComplexCsvAndStoreRoles(csvText);
            console.log('roles.csvを自動的に読み込みました。');
        })
        .catch(error => {
            console.warn(error.message);
        });

    csvFileInput.addEventListener('change', handleCsvFile);

    generateButton.addEventListener('click', () => {
        // 入力値の取得
        const participants = document.getElementById('participants').value.trim().split('\n');
        const villagerRoles = document.getElementById('villager-roles').value.trim().split('\n');
        const werewolfRoles = document.getElementById('werewolf-roles').value.trim().split('\n');
        const thirdPartyRoles = document.getElementById('third-party-roles').value.trim().split('\n');
        const villagerCount = parseInt(document.getElementById('villager-count').value, 10);
        const werewolfCount = parseInt(document.getElementById('werewolf-count').value, 10);
        const thirdPartyCount = parseInt(document.getElementById('third-party-count').value, 10);

        // 簡単なバリデーション
        const totalRoles = villagerCount + werewolfCount + thirdPartyCount;
        if (participants.length !== totalRoles) {
            alert(`参加者の人数 (${participants.length}人) と、割り当てる役職の合計数 (${totalRoles}人) が一致しません。`);
            return;
        }

        // 役職リストの作成とシャッフル
                // 役職リストの作成とシャッフル (parsedRolesDataから詳細情報を持つ役職オブジェクトを取得)
        let allRolesWithDetails = [];
        allRolesWithDetails = allRolesWithDetails.concat(selectRandomRolesWithDetails(parsedRolesData.villager, villagerCount));
        allRolesWithDetails = allRolesWithDetails.concat(selectRandomRolesWithDetails(parsedRolesData.werewolf, werewolfCount));
        allRolesWithDetails = allRolesWithDetails.concat(selectRandomRolesWithDetails(parsedRolesData.thirdParty, thirdPartyCount));
        shuffleArray(allRolesWithDetails);

        // 参加者と役職の割り当てデータを作成
        const assignments = {};
        const passwords = {};
        const shuffledParticipants = [...participants];
        shuffleArray(shuffledParticipants);

        // 合言葉の単語リストをシャッフルして、重複なく使えるように準備
        const shuffledPasswordWords = [...PASSWORD_WORDS];
        shuffleArray(shuffledPasswordWords);
        if (shuffledParticipants.length > shuffledPasswordWords.length) {
            alert('参加者の人数が合言葉リストの上限を超えています。開発者にご連絡ください。');
            return;
        }

        shuffledParticipants.forEach((participant, index) => {
            const password = shuffledPasswordWords[index]; // シャッフルされたリストから合言葉を取得
            assignments[password] = {
                name: participant,
                role: allRolesWithDetails[index]
            };
            passwords[participant] = password;
        });

        // データを暗号化してURLを生成
        const encryptedString = simpleEncrypt(assignments);
        const playerPageUrl = window.location.href.replace(/index\.html$/, 'player.html');
        const sharedUrl = `${playerPageUrl}#${encryptedString}`;

        // 結果の表示
        document.getElementById('shared-url').value = sharedUrl;
        const passwordsList = document.getElementById('passwords-list');
        passwordsList.textContent = ''; // クリア
        for (const name in passwords) {
            passwordsList.textContent += `${name}: ${passwords[name]}\n`;
        }

        document.getElementById('result-area').style.display = 'block';
    });

    const copyUrlButton = document.getElementById('copy-url-button');
    copyUrlButton.addEventListener('click', () => {
        const urlInput = document.getElementById('shared-url');
        urlInput.select();
        document.execCommand('copy');
        alert('URLをコピーしました！');
    });
}

// CSVファイルを処理する関数
function handleCsvFile(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        try {
            parseComplexCsvAndStoreRoles(text);
        } catch (error) {
            alert(error.message);
        }
    };
    reader.readAsText(file);
}

// CSVテキストを解析してテキストエリアに設定する関数
let parsedRolesData = {
    villager: [],
    werewolf: [],
    thirdParty: []
};

// CSVテキストを解析してテキストエリアに設定する関数 (新しい形式に対応)
function parseComplexCsvAndStoreRoles(csvText) {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) {
        throw new Error('CSVファイルにはヘッダー行と少なくとも1行のデータが必要です。');
    }

    const headers = lines[0].split(',').map(h => h.trim());

    // ヘッダーから役職名、陣営、能力、勝利条件のインデックスをマッピング
    let nameIdx = -1;
    let teamIdx = -1;
    let abilityIdx = -1;
    let winConditionIdx = -1;

    headers.forEach((header, index) => {
        if (header === '役職名') {
            nameIdx = index;
        } else if (header === '陣営') {
            teamIdx = index;
        } else if (header === '能力') {
            abilityIdx = index;
        } else if (header === '勝利条件') {
            winConditionIdx = index;
        }
    });

    if (nameIdx === -1 || teamIdx === -1 || abilityIdx === -1 || winConditionIdx === -1) {
        throw new Error('CSVファイルに「役職名」「陣営」「能力」「勝利条件」のヘッダーが不足しています。変換ツールで生成したCSVを使用してください。');
    }

    // 役職データを解析して格納
    parsedRolesData = {
        villager: [],
        werewolf: [],
        thirdParty: []
    };

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const roleName = cols[nameIdx] ? cols[nameIdx].trim() : '';
        const team = cols[teamIdx] ? cols[teamIdx].trim() : '';
        const ability = cols[abilityIdx] ? cols[abilityIdx].trim() : '';
        const winCondition = cols[winConditionIdx] ? cols[winConditionIdx].trim() : '';

        if (roleName && team) {
            const roleObject = {
                name: roleName,
                team: team,
                ability: ability,
                winCondition: winCondition
            };

            if (team === '村人陣営') {
                parsedRolesData.villager.push(roleObject);
            } else if (team === '人狼陣営') {
                parsedRolesData.werewolf.push(roleObject);
            } else if (team === '第三陣営') {
                parsedRolesData.thirdParty.push(roleObject);
            }
        }
    }

    // GMページのテキストエリアに役職名のみを表示
    document.getElementById('villager-roles').value = parsedRolesData.villager.map(r => r.name).join('\n');
    document.getElementById('werewolf-roles').value = parsedRolesData.werewolf.map(r => r.name).join('\n');
    document.getElementById('third-party-roles').value = parsedRolesData.thirdParty.map(r => r.name).join('\n');
}

// 配列からランダムに要素を選択するヘルパー関数 (詳細情報を持つ役職オブジェクトを返す)
function selectRandomRolesWithDetails(rolesArray, count) {
    const shuffled = [...rolesArray].filter(r => r.name.trim() !== ''); // 名前が空でないものをフィルタ
    shuffleArray(shuffled);
    return shuffled.slice(0, count);
}

// 配列をシャッフルする（Fisher-Yatesアルゴリズム）
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}


// --- プレイヤーページのロジック --- //

function initializePlayerPage() {
    const revealButton = document.getElementById('reveal-button');
    let assignments = null;

    // URLのハッシュから暗号化データを読み込む
    try {
        const encryptedString = window.location.hash.substring(1);
        if (encryptedString) {
            assignments = simpleDecrypt(encryptedString);
        }
        if (!assignments) {
             throw new Error('URLに役職データが含まれていません。');
        }
    } catch (e) {
        document.body.innerHTML = `<h1>エラー</h1><p>無効なURLです。GMから共有された正しいURLを開いているか確認してください。</p><p style="color: red;">${e.message}</p>`;
        return;
    }

    revealButton.addEventListener('click', () => {
        const password = document.getElementById('password-input').value.trim();

        if (!password) {
            alert('合言葉を入力してください。');
            return;
        }

        // 合言葉に対応する役職を検索
        const myData = assignments[password];
        if (myData) {
            document.getElementById('role-output').textContent = myData.role.name;
            document.getElementById('team-output').textContent = myData.role.team;
            document.getElementById('ability-output').textContent = myData.role.ability || 'なし';
            document.getElementById('win-condition-output').textContent = myData.role.winCondition || 'なし';
            document.getElementById('result-display').style.display = 'block';
        } else {
            alert('合言葉が間違っているか、対応する役職が見つかりません。');
            document.getElementById('result-display').style.display = 'none';
        }
    });
}
