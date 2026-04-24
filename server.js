const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// Game Data
const wordCategories = {
    animals: {
        name: "🐾 Animals",
        words: [
            { word: "elephant", emojis: "🐘", hint: "Largest land animal" },
            { word: "giraffe", emojis: "🦒", hint: "Very tall with long neck" },
            { word: "penguin", emojis: "🐧", hint: "Bird that can't fly, loves cold" },
            { word: "kangaroo", emojis: "🦘", hint: "Jumps with a pouch" },
            { word: "dolphin", emojis: "🐬", hint: "Smart sea mammal" },
            { word: "peacock", emojis: "🦚", hint: "Bird with beautiful feathers" },
            { word: "butterfly", emojis: "🦋", hint: "Colorful flying insect" },
            { word: "octopus", emojis: "🐙", hint: "Sea creature with 8 arms" }
        ]
    },
    food: {
        name: "🍕 Food",
        words: [
            { word: "pizza", emojis: "🍕", hint: "Italian with cheese and toppings" },
            { word: "hamburger", emojis: "🍔", hint: "Fast food sandwich" },
            { word: "sushi", emojis: "🍣", hint: "Japanese raw fish dish" },
            { word: "icecream", emojis: "🍦", hint: "Cold sweet dessert" },
            { word: "chocolate", emojis: "🍫", hint: "Sweet brown treat" },
            { word: "donut", emojis: "🍩", hint: "Round with a hole" },
            { word: "popcorn", emojis: "🍿", hint: "Movie snack" },
            { word: "bacon", emojis: "🥓", hint: "Crispy breakfast meat" }
        ]
    },
    movies: {
        name: "🎬 Movies",
        words: [
            { word: "avatar", emojis: "🌌👽", hint: "Blue aliens on Pandora" },
            { word: "titanic", emojis: "🚢❄️", hint: "Ship that sank" },
            { word: "jaws", emojis: "🦈", hint: "Shark movie" },
            { word: "frozen", emojis: "❄️👸", hint: "Disney princess with ice powers" },
            { word: "matrix", emojis: "💊🕶️", hint: "Red pill or blue pill" }
        ]
    },
    sports: {
        name: "⚽ Sports",
        words: [
            { word: "football", emojis: "⚽", hint: "World's most popular sport" },
            { word: "basketball", emojis: "🏀", hint: "Michael Jordan's sport" },
            { word: "tennis", emojis: "🎾", hint: "Roger Federer plays this" },
            { word: "cricket", emojis: "🏏", hint: "Popular in India and England" },
            { word: "swimming", emojis: "🏊", hint: "Michael Phelps sport" }
        ]
    },
    emotions: {
        name: "😊 Emotions",
        words: [
            { word: "happy", emojis: "😊", hint: "Feeling joyful" },
            { word: "sad", emojis: "😢", hint: "Feeling down" },
            { word: "angry", emojis: "😠", hint: "Feeling mad" },
            { word: "excited", emojis: "🤩", hint: "Very enthusiastic" },
            { word: "tired", emojis: "😴", hint: "Need sleep" }
        ]
    }
};

let players = {};
let currentWord = null;
let currentCategory = null;
let roundActive = false;
let roundTimer = null;
let timeLeft = 30;
let leaderboard = [];
let gameStats = {
    totalRounds: 0,
    totalGuesses: 0
};

// Get random word
function getRandomWord() {
    const categories = Object.keys(wordCategories);
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const categoryData = wordCategories[randomCategory];
    const randomWord = categoryData.words[Math.floor(Math.random() * categoryData.words.length)];
    
    return {
        category: randomCategory,
        categoryName: categoryData.name,
        ...randomWord
    };
}

// Start new round
function startNewRound() {
    if (roundTimer) clearInterval(roundTimer);
    
    const wordData = getRandomWord();
    currentWord = wordData.word;
    currentCategory = wordData.category;
    
    roundActive = true;
    timeLeft = 30;
    
    // Reset player guesses for this round
    Object.keys(players).forEach(playerId => {
        players[playerId].hasGuessedThisRound = false;
        players[playerId].roundScore = 0;
    });
    
    io.emit('newRound', {
        emojis: wordData.emojis,
        hint: wordData.hint,
        category: wordData.categoryName,
        wordLength: currentWord.length,
        timeLeft: timeLeft
    });
    
    // Start timer
    roundTimer = setInterval(() => {
        if (roundActive && timeLeft > 0) {
            timeLeft--;
            io.emit('timerUpdate', timeLeft);
            
            if (timeLeft <= 0) {
                endRound();
            }
        }
    }, 1000);
}

// End round
function endRound() {
    roundActive = false;
    if (roundTimer) clearInterval(roundTimer);
    
    // Calculate scores for this round
    let roundResults = [];
    Object.keys(players).forEach(playerId => {
        const player = players[playerId];
        if (player.hasGuessedThisRound) {
            const timeBonus = Math.floor(player.guessTime * 10);
            const scoreGained = 100 + timeBonus;
            player.score += scoreGained;
            player.roundScore = scoreGained;
            roundResults.push({
                name: player.name,
                score: scoreGained,
                guessTime: player.guessTime
            });
        }
    });
    
    io.emit('roundEnd', {
        answer: currentWord,
        results: roundResults.sort((a, b) => b.score - a.score)
    });
    
    // Update leaderboard
    updateLeaderboard();
    
    // Start new round after 5 seconds
    setTimeout(() => {
        startNewRound();
    }, 5000);
}

// Check guess
function checkGuess(playerId, guess) {
    if (!roundActive) return false;
    if (players[playerId].hasGuessedThisRound) return false;
    
    if (guess.toLowerCase() === currentWord.toLowerCase()) {
        const guessTime = 30 - timeLeft;
        players[playerId].hasGuessedThisRound = true;
        players[playerId].guessTime = guessTime;
        players[playerId].totalGuesses++;
        gameStats.totalGuesses++;
        
        io.emit('correctGuess', {
            playerId: playerId,
            playerName: players[playerId].name,
            guessTime: guessTime
        });
        
        return true;
    }
    
    players[playerId].totalGuesses++;
    gameStats.totalGuesses++;
    return false;
}

// Update leaderboard
function updateLeaderboard() {
    const leaderboardArray = Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(p => ({
            name: p.name,
            score: p.score,
            correctGuesses: p.correctGuesses,
            totalGuesses: p.totalGuesses
        }));
    
    io.emit('leaderboardUpdate', leaderboardArray);
}

// Use hint power-up
function useHint(playerId) {
    if (!roundActive) return;
    if (players[playerId].hints <= 0) return;
    
    players[playerId].hints--;
    
    // Reveal a random letter
    let revealed = [];
    for (let i = 0; i < currentWord.length; i++) {
        if (Math.random() < 0.3 && currentWord[i] !== ' ') {
            revealed.push(i);
        }
    }
    
    io.emit('hintUsed', {
        playerId: playerId,
        playerName: players[playerId].name,
        revealedPositions: revealed,
        letter: currentWord[revealed[0]]
    });
}

// Socket.io connection
io.on('connection', (socket) => {
    console.log(`✨ Player connected: ${socket.id}`);
    
    socket.on('playerJoin', (playerName) => {
        players[socket.id] = {
            id: socket.id,
            name: playerName || `Wizard_${Math.floor(Math.random() * 1000)}`,
            score: 0,
            correctGuesses: 0,
            totalGuesses: 0,
            hints: 3,
            hasGuessedThisRound: false,
            guessTime: 0,
            roundScore: 0
        };
        
        socket.emit('gameState', {
            currentWord: currentWord,
            currentCategory: currentCategory,
            roundActive: roundActive,
            timeLeft: timeLeft
        });
        
        io.emit('playerJoined', {
            id: socket.id,
            name: players[socket.id].name,
            playersCount: Object.keys(players).length
        });
        
        updateLeaderboard();
        
        console.log(`📝 ${players[socket.id].name} joined the game!`);
    });
    
    socket.on('makeGuess', (guess) => {
        const isCorrect = checkGuess(socket.id, guess);
        socket.emit('guessResult', {
            correct: isCorrect,
            answer: isCorrect ? currentWord : null
        });
    });
    
    socket.on('useHint', () => {
        useHint(socket.id);
    });
    
    socket.on('sendMessage', (message) => {
        io.emit('chatMessage', {
            playerId: socket.id,
            playerName: players[socket.id]?.name,
            message: message,
            timestamp: new Date().toISOString()
        });
    });
    
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`👋 ${players[socket.id].name} disconnected`);
            delete players[socket.id];
            io.emit('playerLeft', socket.id);
            updateLeaderboard();
        }
    });
});

// Start the game
startNewRound();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║     ✨ WORD WIZARD - Multiplayer Word Game ✨            ║
    ║                                                           ║
    ║     Server running at: http://localhost:${PORT}           ║
    ║                                                           ║
    ║     🎮 How to Play:                                       ║
    ║     - Guess the word based on emojis and hints           ║
    ║     - Faster guesses = more points!                      ║
    ║     - Use hints to reveal letters                        ║
    ║     - Compete with players worldwide!                    ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
    `);
});