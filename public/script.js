// Socket connection
const socket = io();
let playerName = '';
let gameActive = false;
let currentAnswer = '';
let hintsRemaining = 3;

// DOM Elements
const startScreen = document.getElementById('startScreen');
const playerNameInput = document.getElementById('playerNameInput');
const joinGameBtn = document.getElementById('joinGameBtn');
const guessInput = document.getElementById('guessInput');
const guessBtn = document.getElementById('guessBtn');
const hintBtn = document.getElementById('hintBtn');
const hintCountSpan = document.getElementById('hintCount');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const timerSpan = document.getElementById('timer');
const emojiClueDiv = document.getElementById('emojiClue');
const categoryBadge = document.getElementById('categoryBadge');
const hintText = document.getElementById('hintText');
const wordLengthSpan = document.getElementById('wordLength');
const playerScoreSpan = document.getElementById('playerScore');
const correctCountSpan = document.getElementById('correctCount');
const bestRoundSpan = document.getElementById('bestRound');
const onlineCountSpan = document.getElementById('onlineCount');
const resultsCard = document.getElementById('resultsCard');

// Join game
joinGameBtn.addEventListener('click', () => {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        playerName = `Wizard_${Math.floor(Math.random() * 1000)}`;
    }
    
    socket.emit('playerJoin', playerName);
    startScreen.style.display = 'none';
    gameActive = true;
    
    // Enable game controls
    guessInput.disabled = false;
    guessBtn.disabled = false;
    hintBtn.disabled = false;
    chatInput.disabled = false;
    sendChatBtn.disabled = false;
    
    guessInput.focus();
});

// Socket events
socket.on('gameState', (state) => {
    if (state.roundActive) {
        gameActive = true;
        timerSpan.textContent = state.timeLeft;
    }
});

socket.on('newRound', (data) => {
    gameActive = true;
    emojiClueDiv.textContent = data.emojis;
    categoryBadge.textContent = data.category;
    hintText.textContent = data.hint;
    wordLengthSpan.innerHTML = `<i class="fas fa-font"></i> Length: ${data.wordLength} letters`;
    timerSpan.textContent = data.timeLeft;
    currentAnswer = '';
    guessInput.value = '';
    guessInput.disabled = false;
    guessBtn.disabled = false;
    hintBtn.disabled = false;
    guessInput.focus();
    
    // Add animation
    emojiClueDiv.style.animation = 'none';
    setTimeout(() => {
        emojiClueDiv.style.animation = 'float 3s infinite';
    }, 10);
});

socket.on('timerUpdate', (time) => {
    timerSpan.textContent = time;
    
    // Warning when time is low
    if (time <= 5) {
        timerSpan.style.color = '#ff4466';
        timerSpan.style.animation = 'pulseGlow 0.5s infinite';
    } else {
        timerSpan.style.color = '#ff69b4';
        timerSpan.style.animation = 'none';
    }
});

socket.on('correctGuess', (data) => {
    if (data.playerId === socket.id) {
        // Show success message
        showNotification('🎉 Correct! +100 points!', 'success');
        guessInput.disabled = true;
        guessBtn.disabled = true;
        
        // Update player stats locally
        const currentScore = parseInt(playerScoreSpan.textContent);
        playerScoreSpan.textContent = currentScore + 100;
        
        const currentCorrect = parseInt(correctCountSpan.textContent);
        correctCountSpan.textContent = currentCorrect + 1;
        
        // Add celebration effect
        addCelebration();
    } else {
        showNotification(`✨ ${data.playerName} guessed it in ${data.guessTime}s!`, 'info');
    }
});

socket.on('roundEnd', (data) => {
    gameActive = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;
    hintBtn.disabled = true;
    
    // Show answer
    showNotification(`The word was "${data.answer}"!`, 'info');
    
    // Display results
    displayRoundResults(data.results);
});

socket.on('guessResult', (data) => {
    if (data.correct) {
        showNotification(`🎉 Amazing! The word was "${data.answer}"!`, 'success');
        guessInput.disabled = true;
        guessBtn.disabled = true;
        
        // Add celebration
        addCelebration();
    } else {
        showNotification('❌ Wrong guess! Try again!', 'error');
        guessInput.value = '';
        guessInput.focus();
        
        // Shake effect
        guessInput.classList.add('shake');
        setTimeout(() => {
            guessInput.classList.remove('shake');
        }, 300);
    }
});

socket.on('leaderboardUpdate', (leaderboard) => {
    displayLeaderboard(leaderboard);
});

socket.on('playerJoined', (data) => {
    onlineCountSpan.textContent = `${data.playersCount} online`;
    addChatMessage('system', `${data.name} joined the wizard council!`, 'system');
});

socket.on('playerLeft', (playerId) => {
    // Update online count
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.innerHTML = `<em style="color: #ff4466;">A wizard has left the realm...</em>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('chatMessage', (data) => {
    addChatMessage(data.playerName, data.message, 'user');
});

socket.on('hintUsed', (data) => {
    if (data.playerId === socket.id) {
        hintsRemaining--;
        hintCountSpan.textContent = hintsRemaining;
        showNotification(`🔮 Hint used! Letter revealed: ${data.letter}`, 'info');
        
        if (hintsRemaining === 0) {
            hintBtn.disabled = true;
        }
    } else {
        showNotification(`${data.playerName} used a hint!`, 'info');
    }
});

// Make guess
guessBtn.addEventListener('click', () => {
    if (!gameActive) return;
    
    const guess = guessInput.value.trim();
    if (!guess) {
        showNotification('Enter a guess!', 'error');
        return;
    }
    
    socket.emit('makeGuess', guess);
});

guessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && gameActive) {
        guessBtn.click();
    }
});

// Use hint
hintBtn.addEventListener('click', () => {
    if (!gameActive || hintsRemaining <= 0) return;
    socket.emit('useHint');
});

// Chat
sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (!message) return;
    
    socket.emit('sendMessage', message);
    chatInput.value = '';
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatBtn.click();
    }
});

// Functions
function displayLeaderboard(leaderboard) {
    const leaderboardList = document.getElementById('leaderboardList');
    
    if (leaderboard.length === 0) {
        leaderboardList.innerHTML = '<div class="text-center" style="padding: 20px; color: rgba(255,255,255,0.5);">No wizards yet...</div>';
        return;
    }
    
    leaderboardList.innerHTML = leaderboard.map((player, index) => {
        let rankClass = '';
        if (index === 0) rankClass = 'rank-1';
        else if (index === 1) rankClass = 'rank-2';
        else if (index === 2) rankClass = 'rank-3';
        
        return `
            <div class="leaderboard-item">
                <div class="leaderboard-rank ${rankClass}">
                    ${index === 0 ? '👑' : index + 1}
                </div>
                <div class="leaderboard-name">${player.name}</div>
                <div class="leaderboard-score">${player.score}</div>
            </div>
        `;
    }).join('');
}

function displayRoundResults(results) {
    const roundResults = document.getElementById('roundResults');
    
    if (results.length === 0) {
        roundResults.innerHTML = '<div class="text-center" style="padding: 20px;">No one guessed this round!</div>';
    } else {
        roundResults.innerHTML = results.map((result, index) => `
            <div class="result-item">
                <div class="result-name">
                    ${index === 0 ? '🏆 ' : ''}${result.name}
                </div>
                <div class="result-score">+${result.score}</div>
            </div>
        `).join('');
    }
    
    resultsCard.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        resultsCard.style.display = 'none';
    }, 5000);
}

function addChatMessage(name, message, type) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (type === 'system') {
        messageDiv.innerHTML = `<em style="color: #ffd700;">✨ ${message}</em>`;
    } else {
        messageDiv.innerHTML = `
            <strong>${name}</strong>
            <span class="time">${time}</span>
            <div>${escapeHtml(message)}</div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Limit messages
    while (chatMessages.children.length > 50) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? 'linear-gradient(135deg, #00b09b, #96c93d)' : type === 'error' ? 'linear-gradient(135deg, #f5576c, #f093fb)' : 'linear-gradient(135deg, #667eea, #764ba2)'};
        color: white;
        padding: 12px 24px;
        border-radius: 50px;
        font-weight: 600;
        z-index: 1000;
        animation: fadeIn 0.3s ease;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function addCelebration() {
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.innerHTML = ['🎉', '✨', '⭐', '🌟'][Math.floor(Math.random() * 4)];
        particle.style.cssText = `
            position: fixed;
            left: ${Math.random() * window.innerWidth}px;
            top: ${Math.random() * window.innerHeight}px;
            font-size: ${Math.random() * 20 + 10}px;
            animation: floatUp 1s ease-out forwards;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(particle);
        
        setTimeout(() => particle.remove(), 1000);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes floatUp {
        0% {
            opacity: 1;
            transform: translateY(0) rotate(0deg);
        }
        100% {
            opacity: 0;
            transform: translateY(-100px) rotate(360deg);
        }
    }
    
    .shake {
        animation: shakeAnim 0.3s ease;
    }
    
    @keyframes shakeAnim {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Enter key for name input
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinGameBtn.click();
    }
});

// Close results button
document.getElementById('closeResults')?.addEventListener('click', () => {
    resultsCard.style.display = 'none';
});