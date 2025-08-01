document.addEventListener('DOMContentLoaded', () => {
    const inputCsvFile = document.getElementById('input-csv-file');
    const convertButton = document.getElementById('convert-button');
    const outputCsvText = document.getElementById('output-csv-text');
    const downloadLink = document.getElementById('download-link');
    const outputArea = document.getElementById('output-area');

    convertButton.addEventListener('click', () => {
        const file = inputCsvFile.files[0];
        if (!file) {
            alert('CSVファイルを選択してください。');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            try {
                const convertedCsv = convertCsv(text);
                outputCsvText.value = convertedCsv;
                const blob = new Blob([convertedCsv], { type: 'text/csv;charset=utf-8;' });
                downloadLink.href = URL.createObjectURL(blob);
                outputArea.style.display = 'block';
            } catch (error) {
                alert('CSVの変換中にエラーが発生しました: ' + error.message);
                outputArea.style.display = 'none';
            }
        };
        reader.readAsText(file);
    });
});

function convertCsv(csvText) {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) {
        throw new Error('CSVファイルにはヘッダー行と少なくとも1行のデータが必要です。');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const rolesData = {}; // 役職名 -> { team, ability, winCondition, author } のマップ

    // ヘッダーから役職名、能力、勝利条件、制作者名のインデックスをマッピング
    const roleMap = {
        villager: { name: [], ability: [], winCondition: [] },
        werewolf: { name: [], ability: [], winCondition: [] },
        thirdParty: { name: [], ability: [], winCondition: [] }
    };
    let authorIndex = -1;

    headers.forEach((header, index) => {
        if (header.match(/^\d-1役職名$/)) {
            const team = header.startsWith('1-') || header.startsWith('2-') ? 'werewolf' : (header.startsWith('3-') || header.startsWith('4-') ? 'villager' : 'thirdParty');
            roleMap[team].name.push(index);
        } else if (header.match(/^\d-2能力$/)) {
            const team = header.startsWith('1-') || header.startsWith('2-') ? 'werewolf' : (header.startsWith('3-') || header.startsWith('4-') ? 'villager' : 'thirdParty');
            roleMap[team].ability.push(index);
        } else if (header.match(/^\d-3勝利条件$/)) { // 5-3勝利条件に対応
            roleMap.thirdParty.winCondition.push(index);
        } else if (header === '名前') {
            authorIndex = index;
        }
    });

    if (authorIndex === -1) {
        throw new Error('CSVファイルに「名前」ヘッダーが見つかりません。');
    }

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const author = cols[authorIndex] ? cols[authorIndex].trim() : '';

        // 人狼陣営
        roleMap.werewolf.name.forEach((nameIdx, j) => {
            const roleName = cols[nameIdx] ? cols[nameIdx].trim() : '';
            if (roleName && !rolesData[roleName]) {
                const ability = roleMap.werewolf.ability[j] && cols[roleMap.werewolf.ability[j]] ? cols[roleMap.werewolf.ability[j]].trim() : '';
                rolesData[roleName] = {
                    team: '人狼陣営',
                    ability: ability,
                    winCondition: '人狼陣営以外を全員殺害すること。',
                    author: author
                };
            }
        });

        // 村人陣営
        roleMap.villager.name.forEach((nameIdx, j) => {
            const roleName = cols[nameIdx] ? cols[nameIdx].trim() : '';
            if (roleName && !rolesData[roleName]) {
                const ability = roleMap.villager.ability[j] && cols[roleMap.villager.ability[j]] ? cols[roleMap.villager.ability[j]].trim() : '';
                rolesData[roleName] = {
                    team: '村人陣営',
                    ability: ability,
                    winCondition: '人狼陣営を殺害すること。',
                    author: author
                };
            }
        });

        // 第三陣営
        roleMap.thirdParty.name.forEach((nameIdx, j) => {
            const roleName = cols[nameIdx] ? cols[nameIdx].trim() : '';
            if (roleName && !rolesData[roleName]) {
                const ability = roleMap.thirdParty.ability[j] && cols[roleMap.thirdParty.ability[j]] ? cols[roleMap.thirdParty.ability[j]].trim() : '';
                const winCondition = roleMap.thirdParty.winCondition[j] && cols[roleMap.thirdParty.winCondition[j]] ? cols[roleMap.thirdParty.winCondition[j]].trim() : '';
                rolesData[roleName] = {
                    team: '第三陣営',
                    ability: ability,
                    winCondition: winCondition,
                    author: author
                };
            }
        });
    }

    // 変換済みCSVのヘッダー
    let convertedCsv = '役職名,陣営,能力,勝利条件,制作者\n';

    // 役職データをCSV形式に変換
    for (const roleName in rolesData) {
        const data = rolesData[roleName];
        convertedCsv += `"${roleName}","${data.team}","${data.ability}","${data.winCondition}","${data.author}"\n`;
    }

    return convertedCsv;
}
