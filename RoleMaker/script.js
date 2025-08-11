document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const outputTextarea = document.getElementById('output');

    generateBtn.addEventListener('click', () => {
        const getVal = (id) => document.getElementById(id)?.value || '';

        const roleName = getVal('role-name');
        const author = getVal('author');

        if (!roleName || !author) {
            alert('「役職名」と「制作者」は必須です。');
            return;
        }

        let roleObject = {};
        const title = document.querySelector('title').textContent;

        if (title.includes('村人陣営')) {
            roleObject = {
                "役職名": roleName,
                "陣営": "村人陣営",
                "分類": getVal('category'),
                "能力": getVal('ability'),
                "占い結果": getVal('fortune-result'),
                "関連役職": getVal('related-role'),
                "関連役職人数": getVal('related-role-count'),
                "勝利条件": "人狼を全て処刑する",
                "制作者": author
            };
        } else if (title.includes('人狼陣営')) {
            roleObject = {
                "役職名": roleName,
                "陣営": "人狼陣営",
                "分類": getVal('category'),
                "能力": getVal('ability'),
                "占い結果": getVal('fortune-result'),
                "関連役職": getVal('related-role'),
                "関連役職人数": getVal('related-role-count'),
                "勝利条件": "人間を全滅させる",
                "制作者": author
            };
        } else if (title.includes('第三陣営')) {
            roleObject = {
                "役職名": roleName,
                "陣営": "第三陣営",
                "分類": null,
                "能力": getVal('ability'),
                "占い結果": getVal('fortune-result'),
                "関連役職": getVal('related-role'),
                "関連役職人数": getVal('related-role-count'),
                "勝利条件": getVal('win-condition'),
                "制作者": author
            };
        }

        // JSONを整形して出力 (インデント4)
        const jsonString = JSON.stringify(roleObject, null, 4);
        outputTextarea.value = jsonString;
    });

    copyBtn.addEventListener('click', () => {
        if (outputTextarea.value) {
            navigator.clipboard.writeText(outputTextarea.value)
                .then(() => alert('コピーしました！'))
                .catch(err => alert('コピーに失敗しました: ' + err));
        }
    });
});