// Core Timer Logic and UI Integration

const STATES = {
    IDLE: 'IDLE',
    ROUND: 'ROUND',
    BREAK: 'BREAK',
    FINISHED: 'FINISHED'
};

class BoxingTimer {
    constructor() {
        this.config = this.loadConfig();
        this.state = STATES.IDLE;
        this.currentRound = 1;
        this.timeLeft = this.config.roundTime;
        this.totalStateTime = this.config.roundTime;
        
        this.timerId = null;
        this.lastTime = 0;
        
        // Random Beep state
        this.nextBeepTime = null;

        this.initUI();
        this.bindEvents();
        this.updateDisplay();
    }

    loadConfig() {
        const saved = localStorage.getItem('boxingTimerConfig');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            rounds: 3,
            roundTime: 180, // 3 mins
            breakTime: 60,  // 1 min
            warnRound: 30,
            warnBreak: 10,
            beepEnabled: false,
            beepMin: 3,
            beepMax: 10
        };
    }

    saveConfig() {
        localStorage.setItem('boxingTimerConfig', JSON.stringify(this.config));
    }

    initUI() {
        // Elements
        this.elTimerDisplay = document.getElementById('timer-display');
        this.elStatusLabel = document.getElementById('status-label');
        this.elRoundInfo = document.getElementById('round-info');
        this.elProgressCircle = document.getElementById('progress-circle');
        
        this.btnPlayPause = document.getElementById('play-pause-btn');
        this.iconPlay = document.getElementById('icon-play');
        this.iconPause = document.getElementById('icon-pause');
        this.btnReset = document.getElementById('reset-btn');
        this.btnSkip = document.getElementById('skip-btn');
        
        // Settings UI
        this.settingsScreen = document.getElementById('settings');
        this.populateSettings();
    }

    bindEvents() {
        // Controls
        this.btnPlayPause.addEventListener('click', () => this.toggleTimer());
        this.btnReset.addEventListener('click', () => this.resetTimer());
        this.btnSkip.addEventListener('click', () => this.skipState());

        // Settings Modal
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.pauseTimer();
            this.settingsScreen.classList.remove('hidden');
            this.populateSettings();
        });
        
        document.getElementById('close-settings-btn').addEventListener('click', () => {
            this.saveSettingsFromUI();
            this.settingsScreen.classList.add('hidden');
            this.resetTimer();
        });

        document.getElementById('save-settings-btn').addEventListener('click', () => {
            this.saveSettingsFromUI();
            this.settingsScreen.classList.add('hidden');
            this.resetTimer();
        });

        // Auto-save on input changes
        const settingsInputs = this.settingsScreen.querySelectorAll('input');
        settingsInputs.forEach(input => {
            input.addEventListener('change', () => {
                if (input.type !== 'file') {
                    this.saveSettingsFromUI();
                    this.resetTimer();
                }
            });
        });

        // Auto-save when app is backgrounded/closed
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                if (!this.settingsScreen.classList.contains('hidden')) {
                    this.saveSettingsFromUI();
                }
                this.saveConfig();
            }
        });

        // Audio Tests
        document.getElementById('test-bell-btn').addEventListener('click', () => window.audioManager.play('bell'));
        document.getElementById('test-warning-btn').addEventListener('click', () => window.audioManager.play('warning'));
        document.getElementById('test-beep-btn').addEventListener('click', () => window.audioManager.play('beep'));

        // Audio Uploads
        const handleAudioUpload = (id, type) => {
            document.getElementById(id).addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) window.audioManager.setCustomAudio(type, file);
            });
        };
        handleAudioUpload('audio-bell', 'bell');
        handleAudioUpload('audio-warning', 'warning');
        handleAudioUpload('audio-beep', 'beep');

        document.getElementById('clear-audio-btn').addEventListener('click', async () => {
            await window.audioManager.clearDB();
            document.getElementById('audio-bell').value = '';
            document.getElementById('audio-warning').value = '';
            document.getElementById('audio-beep').value = '';
            alert("Audio reset to default sounds.");
        });

        // Beep toggle UI logic
        const beepEnable = document.getElementById('setting-beep-enable');
        const updateBeepUI = () => {
            const opacity = beepEnable.checked ? '1' : '0.5';
            const pointer = beepEnable.checked ? 'auto' : 'none';
            document.getElementById('beep-min-row').style.opacity = opacity;
            document.getElementById('beep-min-row').style.pointerEvents = pointer;
            document.getElementById('beep-max-row').style.opacity = opacity;
            document.getElementById('beep-max-row').style.pointerEvents = pointer;
        };
        beepEnable.addEventListener('change', updateBeepUI);
    }

    populateSettings() {
        document.getElementById('setting-rounds').value = this.config.rounds;
        
        document.getElementById('setting-round-m').value = Math.floor(this.config.roundTime / 60);
        document.getElementById('setting-round-s').value = this.config.roundTime % 60;
        
        document.getElementById('setting-break-m').value = Math.floor(this.config.breakTime / 60);
        document.getElementById('setting-break-s').value = this.config.breakTime % 60;
        
        document.getElementById('setting-warn-round').value = this.config.warnRound;
        document.getElementById('setting-warn-break').value = this.config.warnBreak;
        
        const beepEnable = document.getElementById('setting-beep-enable');
        beepEnable.checked = this.config.beepEnabled;
        document.getElementById('setting-beep-min').value = this.config.beepMin;
        document.getElementById('setting-beep-max').value = this.config.beepMax;
        
        // Trigger UI update
        beepEnable.dispatchEvent(new Event('change'));
    }

    saveSettingsFromUI() {
        const getVal = (id, min = 0) => Math.max(min, parseInt(document.getElementById(id).value) || min);
        
        this.config = {
            rounds: getVal('setting-rounds', 1),
            roundTime: getVal('setting-round-m') * 60 + getVal('setting-round-s'),
            breakTime: getVal('setting-break-m') * 60 + getVal('setting-break-s'),
            warnRound: getVal('setting-warn-round'),
            warnBreak: getVal('setting-warn-break'),
            beepEnabled: document.getElementById('setting-beep-enable').checked,
            beepMin: getVal('setting-beep-min', 1),
            beepMax: getVal('setting-beep-max', 2)
        };
        
        if (this.config.roundTime < 1) this.config.roundTime = 1;
        
        this.saveConfig();
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    updateDisplay() {
        this.elTimerDisplay.textContent = this.formatTime(this.timeLeft);
        
        // Progress circle
        const progress = this.timeLeft / this.totalStateTime;
        const offset = 283 - (progress * 283); // 283 is the stroke-dasharray (circumference)
        this.elProgressCircle.style.strokeDashoffset = isNaN(offset) ? 0 : offset;

        if (this.state === STATES.IDLE) {
            this.elStatusLabel.textContent = "READY";
            this.elRoundInfo.textContent = `Round 1 / ${this.config.rounds}`;
            document.body.className = 'theme-idle';
        } else if (this.state === STATES.FINISHED) {
            this.elStatusLabel.textContent = "FINISHED";
            this.elRoundInfo.textContent = `Completed ${this.config.rounds} Rounds`;
            document.body.className = 'theme-idle';
            this.elProgressCircle.style.strokeDashoffset = 0;
            this.elTimerDisplay.textContent = "00:00";
        } else {
            this.elStatusLabel.textContent = this.state;
            this.elRoundInfo.textContent = `Round ${this.currentRound} / ${this.config.rounds}`;
            document.body.className = this.state === STATES.ROUND ? 'theme-round' : 'theme-break';
        }

        // Toggle icons
        if (this.timerId) {
            this.iconPlay.classList.add('hidden');
            this.iconPause.classList.remove('hidden');
        } else {
            this.iconPlay.classList.remove('hidden');
            this.iconPause.classList.add('hidden');
        }
    }

    scheduleNextBeep() {
        if (!this.config.beepEnabled || this.state !== STATES.ROUND) return;
        
        const min = this.config.beepMin;
        const max = this.config.beepMax;
        const interval = Math.random() * (max - min) + min;
        
        this.nextBeepTime = this.timeLeft - interval;
    }

    toggleTimer() {
        if (this.state === STATES.FINISHED) {
            this.resetTimer();
            return;
        }

        if (this.timerId) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        if (this.state === STATES.IDLE) {
            this.transitionToState(STATES.ROUND);
        } else {
            // Resuming
            this.lastTime = performance.now();
            this.timerId = requestAnimationFrame((t) => this.tick(t));
            window.audioManager.ctx.resume(); // Ensure audio context is active
        }
        this.updateDisplay();
    }

    pauseTimer() {
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
            this.updateDisplay();
        }
    }

    resetTimer() {
        this.pauseTimer();
        this.state = STATES.IDLE;
        this.currentRound = 1;
        this.totalStateTime = this.config.roundTime;
        this.timeLeft = this.config.roundTime;
        this.updateDisplay();
    }

    skipState() {
        if (this.state === STATES.IDLE || this.state === STATES.FINISHED) return;
        this.timeLeft = 0; // Will trigger transition on next tick or force it
        if (!this.timerId) {
            // If paused, force tick logic manually
            this.handleStateEnd();
        }
    }

    tick(currentTime) {
        if (!this.timerId) return;

        const delta = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        const previousTimeLeft = this.timeLeft;
        this.timeLeft -= delta;

        this.checkEvents(previousTimeLeft, this.timeLeft);

        if (this.timeLeft <= 0) {
            this.handleStateEnd();
        } else {
            this.updateDisplay();
            this.timerId = requestAnimationFrame((t) => this.tick(t));
        }
    }

    checkEvents(prev, curr) {
        // Warning signals
        if (this.state === STATES.ROUND && this.config.warnRound > 0) {
            if (prev >= this.config.warnRound && curr < this.config.warnRound) {
                window.audioManager.play('warning');
            }
        }
        if (this.state === STATES.BREAK && this.config.warnBreak > 0) {
            if (prev >= this.config.warnBreak && curr < this.config.warnBreak) {
                window.audioManager.play('warning');
            }
        }

        // Random Beep logic
        if (this.config.beepEnabled && this.state === STATES.ROUND) {
            if (this.nextBeepTime !== null && curr <= this.nextBeepTime) {
                window.audioManager.play('beep');
                this.scheduleNextBeep();
            }
        }
    }

    handleStateEnd() {
        this.pauseTimer();

        if (this.state === STATES.ROUND) {
            if (this.currentRound >= this.config.rounds) {
                this.transitionToState(STATES.FINISHED);
            } else {
                this.transitionToState(STATES.BREAK);
            }
        } else if (this.state === STATES.BREAK) {
            this.currentRound++;
            this.transitionToState(STATES.ROUND);
        }
    }

    transitionToState(newState) {
        this.state = newState;
        
        if (newState === STATES.ROUND) {
            this.totalStateTime = this.config.roundTime;
            this.timeLeft = this.config.roundTime;
            window.audioManager.play('bell');
            this.scheduleNextBeep();
            this.startTimer();
        } else if (newState === STATES.BREAK) {
            this.totalStateTime = this.config.breakTime;
            this.timeLeft = this.config.breakTime;
            window.audioManager.play('bell');
            this.startTimer();
        } else if (newState === STATES.FINISHED) {
            window.audioManager.play('bell');
            setTimeout(() => window.audioManager.play('bell'), 600); // Double bell for finish
            this.updateDisplay();
        }
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    window.boxingTimer = new BoxingTimer();
});
