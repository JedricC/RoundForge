// Audio Manager using Web Audio API for default sounds and IndexedDB for custom uploads

const DB_NAME = 'BoxingTimerAudioDB';
const STORE_NAME = 'audioFiles';

class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.customAudio = {
            bell: null,
            warning: null,
            beep: null
        };
        this.db = null;
        this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this.loadCustomAudioFromDB();
                resolve();
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    async loadCustomAudioFromDB() {
        const types = ['bell', 'warning', 'beep'];
        for (const type of types) {
            try {
                const file = await this.getFromDB(type);
                if (file) {
                    this.customAudio[type] = await this.createAudioBufferFromFile(file);
                    console.log(`Loaded custom ${type} from DB`);
                }
            } catch (e) {
                console.error(`Failed to load ${type} from DB`, e);
            }
        }
    }

    async saveToDB(key, file) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(file, key);
            
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getFromDB(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve(null);
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async clearDB() {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = () => {
                this.customAudio = { bell: null, warning: null, beep: null };
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async createAudioBufferFromFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        return await this.ctx.decodeAudioData(arrayBuffer);
    }

    async setCustomAudio(type, file) {
        try {
            await this.saveToDB(type, file);
            this.customAudio[type] = await this.createAudioBufferFromFile(file);
        } catch (e) {
            console.error(`Error setting custom audio for ${type}:`, e);
            alert("Failed to load audio file. Please ensure it is a valid audio format.");
        }
    }

    play(type) {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (this.customAudio[type]) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.customAudio[type];
            source.connect(this.ctx.destination);
            source.start();
        } else {
            // Fallback to default synthesized sounds
            this.playDefaultSound(type);
        }
    }

    playDefaultSound(type) {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'bell') {
            // Boxing bell simulation (metallic, decaying)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(300, t + 1.5);
            
            gain.gain.setValueAtTime(1, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 2);
            
            osc.start(t);
            osc.stop(t + 2);
            
            // Add a higher harmonic
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1200, t);
            gain2.gain.setValueAtTime(0.5, t);
            gain2.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start(t);
            osc2.stop(t + 1.5);

        } else if (type === 'warning') {
            // Short wooden block / clapper sound
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, t);
            gain.gain.setValueAtTime(0.8, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.start(t);
            osc.stop(t + 0.2);
            
        } else if (type === 'beep') {
            // Trainer reaction beep
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, t);
            gain.gain.setValueAtTime(1, t);
            gain.gain.setValueAtTime(1, t + 0.1);
            gain.gain.linearRampToValueAtTime(0, t + 0.15);
            osc.start(t);
            osc.stop(t + 0.15);
        }
    }
}

window.audioManager = new AudioManager();
