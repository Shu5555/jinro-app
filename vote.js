document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        alert('Firebaseが読み込まれていません。firebase-config.jsが正しく設定されているか確認してください。');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');
    const myName = urlParams.get('name');
    const isGM = myName === 'GM';

    if (!gameId || !myName) {
        alert('URLが無効です。正しいURLからアクセスしてください。');
        return;
    }

    // Firebase Realtime Databaseの参照を取得
    const db = firebase.database();
    const gameRef = db.ref('games/' + gameId);
    const votesRef = db.ref(`games/${gameId}/votes`);
    const chatRef = db.ref(`games/${gameId}/chat`);

    // 要素の取得
    const playerVoteSection = document.getElementById('player-vote-section');
    const gmVoteSection = document.getElementById('gm-vote-section');
    const participantListPlayer = document.getElementById('participant-list-player');
    const voteStatus = document.getElementById('vote-status');
    const chatArea = document.getElementById('chat-area');
    const chatWithSelection = document.getElementById('chat-with-selection');
    const chatPartnerSelect = document.getElementById('chat-partner');
    const chatWithLabel = document.getElementById('chat-with-label');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');

    let participants = [];
    let chatPartner = isGM ? null : 'GM';

    // ゲーム状態の監視
    gameRef.on('value', (snapshot) => {
        const gameState = snapshot.val();
        if (gameState && gameState.participants) {
            participants = gameState.participants;
            updateUI(gameState);
        }
    });

    // UIの更新
    function updateUI(state) {
        if (isGM) {
            playerVoteSection.style.display = 'none';
            gmVoteSection.style.display = 'block';
            chatWithSelection.style.display = 'block';
            updateVoteStatus(state.votes || {}, state.participants);
            updateChatPartnerList(state.participants);
        } else {
            playerVoteSection.style.display = 'block';
            gmVoteSection.style.display = 'none';
            chatWithSelection.style.display = 'none';
            updateParticipantList(state.participants);
            chatWithLabel.textContent = `GMとのチャット`;
        }
        updateChatHistory(); // チャット履歴も更新
    }

    // 投票状況の更新 (GM用)
    function updateVoteStatus(votes, participants) {
        voteStatus.innerHTML = '';
        participants.forEach(p => {
            if (p === 'GM') return;
            const target = votes[p] || '未投票';
            const voteItem = document.createElement('div');
            voteItem.className = 'vote-item';
            voteItem.innerHTML = `<span><strong>${p}</strong> -> ${target}</span>`;
            voteStatus.appendChild(voteItem);
        });
    }

    // 参加者リストの更新 (プレイヤー用)
    function updateParticipantList(participants) {
        participantListPlayer.innerHTML = '';
        participants.forEach(p => {
            if (p === myName || p === 'GM') return;
            const button = document.createElement('button');
            button.textContent = p;
            button.addEventListener('click', () => {
                if (confirm(`${p}に投票しますか？`)) {
                    votesRef.child(myName).set(p);
                }
            });
            participantListPlayer.appendChild(button);
        });
    }

    // チャット相手リストの更新 (GM用)
    function updateChatPartnerList(participants) {
        const currentPartner = chatPartnerSelect.value;
        chatPartnerSelect.innerHTML = '<option value="">相手を選択...</option>';
        participants.forEach(p => {
            if (p === 'GM') return;
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            chatPartnerSelect.appendChild(option);
        });
        if (currentPartner) {
            chatPartnerSelect.value = currentPartner;
        }
    }

    // チャット履歴の表示
    function updateChatHistory() {
        if (!chatPartner) {
            chatMessages.innerHTML = '';
            return;
        }
        const room = [myName, chatPartner].sort().join('-');
        const roomChatRef = chatRef.child(room);

        roomChatRef.on('value', (snapshot) => {
            chatMessages.innerHTML = '';
            const messages = snapshot.val();
            if (messages) {
                Object.values(messages).forEach(msg => displayChatMessage(msg));
            }
        });
    }

    // チャットメッセージの表示
    function displayChatMessage(msg) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${msg.from === myName ? 'sent' : 'received'}`;
        messageEl.textContent = `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.from}: ${msg.text}`;
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // メッセージ送信処理
    function sendMessage() {
        const text = chatInput.value.trim();
        if (text && chatPartner) {
            const room = [myName, chatPartner].sort().join('-');
            const newMessageRef = chatRef.child(room).push();
            newMessageRef.set({
                from: myName,
                to: chatPartner,
                text: text,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            chatInput.value = '';
        }
    }

    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    if (isGM) {
        chatPartnerSelect.addEventListener('change', () => {
            chatPartner = chatPartnerSelect.value;
            chatWithLabel.textContent = chatPartner ? `${chatPartner}とのチャット` : 'チャット相手を選択してください';
            updateChatHistory();
        });
    }
});
