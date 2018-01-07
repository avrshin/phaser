var Class = require('../utils/Class');
var NOOP = require('../utils/NOOP');
var EventDispatcher = require('../events/EventDispatcher');
var SoundEvent = require('./SoundEvent');
var SoundValueEvent = require('./SoundValueEvent');
/*!
 * @author Pavle Goloskokovic <pgoloskokovic@gmail.com> (http://prunegames.com)
 */
var BaseSoundManager = new Class({
    /**
     * The sound manager is responsible for playing back audio via Web Audio API or HTML Audio tag as fallback.
     * The audio file type and the encoding of those files are extremely important.
     * Not all browsers can play all audio formats.
     * There is a good guide to what's supported [here](https://developer.mozilla.org/en-US/Apps/Fundamentals/Audio_and_video_delivery/Cross-browser_audio_basics#Audio_Codec_Support).
     *
     * @class Phaser.Sound.BaseSoundManager
     * @constructor
     * @param {Phaser.Game} game - Reference to the current game instance.
     */
    initialize: function BaseSoundManager(game) {
        /**
         * Local reference to game.
         *
         * @readonly
         * @property {Phaser.Game} game
         */
        this.game = game;
        /**
         * Event dispatcher used to handle all sound manager related events.
         *
         * @readonly
         * @property {Phaser.Events.EventDispatcher} events
         */
        this.events = new EventDispatcher();
        /**
         * An array containing all added sounds.
         *
         * @private
         * @property {ISound[]} sounds
         * @default []
         */
        this.sounds = [];
        /**
         * Global mute setting.
         *
         * @property {boolean} mute
         * @default false
         */
        this.mute = false;
        /**
         * Global volume setting.
         *
         * @property {number} volume
         * @default 1
         */
        this.volume = 1;
        /**
         * Global playback rate at which all the sounds will be played.
         * Value of 1.0 plays the audio at full speed, 0.5 plays the audio at half speed
         * and 2.0 doubles the audio's playback speed.
         *
         * @property {number} rate
         * @default 1
         */
        this.rate = 1;
        /**
         * Global detuning of all sounds in [cents](https://en.wikipedia.org/wiki/Cent_%28music%29).
         * The range of the value is -1200 to 1200, but we recommend setting it to [50](https://en.wikipedia.org/wiki/50_Cent).
         *
         * @property {number} detune
         * @default 0
         */
        this.detune = 0;
        /**
         * Flag indicating if sounds should be paused when game looses focus,
         * for instance when user switches to another tab/program/app.
         *
         * @property {boolean} pauseOnBlur
         * @default true
         */
        this.pauseOnBlur = true;
        game.events.on('ON_BLUR', function () {
            if (this.pauseOnBlur) {
                this.onBlur();
            }
        }.bind(this));
        game.events.on('ON_FOCUS', function () {
            if (this.pauseOnBlur) {
                this.onFocus();
            }
        }.bind(this));
        /**
         * Property that actually holds the value of global playback rate.
         *
         * @private
         * @property {number} _rate
         * @default 1
         */
        this._rate = 1;
        /**
         * Property that actually holds the value of global detune.
         *
         * @private
         * @property {number} _detune
         * @default 0
         */
        this._detune = 0;
    },
    /**
     * Adds a new sound into the sound manager.
     *
     * @override
     * @method Phaser.Sound.BaseSoundManager#add
     * @param {string} key - Asset key for the sound.
     * @param {ISoundConfig} [config] - An optional config object containing default sound settings.
     * @returns {ISound} The new sound instance.
     */
    add: NOOP,
    /**
     * Adds a new audio sprite sound into the sound manager.
     *
     * @method Phaser.Sound.BaseSoundManager#addAudioSprite
     * @param {string} key - Asset key for the sound.
     * @param {ISoundConfig} [config] - An optional config object containing default sound settings.
     * @returns {IAudioSpriteSound} The new audio sprite sound instance.
     */
    addAudioSprite: function (key, config) {
        var sound = this.add(key, config);
        /**
         * Local reference to 'spritemap' object form json file generated by audiosprite tool.
         *
         * @property {object} spritemap
         */
        sound.spritemap = this.game.cache.json.get(key).spritemap;
        for (var markerName in sound.spritemap) {
            if (!sound.spritemap.hasOwnProperty(markerName)) {
                continue;
            }
            var marker = sound.spritemap[markerName];
            sound.addMarker({
                name: markerName,
                start: marker.start,
                duration: marker.end - marker.start,
                config: config
            });
        }
        return sound;
    },
    /**
     * Enables playing sound on the fly without the need to keep a reference to it.
     * Sound will auto destroy once its playback ends.
     *
     * @method Phaser.Sound.BaseSoundManager#play
     * @param {string} key - Asset key for the sound.
     * @param {ISoundConfig | ISoundMarker} [extra] - An optional additional object containing settings to be applied to the sound. It could be either config or marker object.
     */
    play: function (key, extra) {
        var sound = this.add(key);
        sound.events.once('SOUND_ENDED', sound.destroy.bind(sound));
        if (extra) {
            if (extra.name) {
                sound.addMarker(extra);
                sound.play(extra.name);
            }
            else {
                sound.play(extra);
            }
        }
        else {
            sound.play();
        }
    },
    /**
     * Enables playing audio sprite sound on the fly without the need to keep a reference to it.
     * Sound will auto destroy once its playback ends.
     *
     * @method Phaser.Sound.BaseSoundManager#playAudioSprite
     * @param {string} key - Asset key for the sound.
     * @param {string} spriteName - The name of the sound sprite to play.
     * @param {ISoundConfig} [config] - An optional config object containing default sound settings.
     */
    playAudioSprite: function (key, spriteName, config) {
        var sound = this.addAudioSprite(key);
        sound.events.once('SOUND_ENDED', sound.destroy.bind(sound));
        sound.play(spriteName, config);
    },
    /**
     * Removes a sound from the sound manager.
     * The removed sound is destroyed before removal.
     *
     * @method Phaser.Sound.BaseSoundManager#remove
     * @param {ISound} sound - The sound object to remove.
     * @returns {boolean} True if the sound was removed successfully, otherwise false.
     */
    remove: function (sound) {
        var index = this.sounds.indexOf(sound);
        if (index !== -1) {
            sound.destroy();
            this.sounds.splice(index, 1);
            return true;
        }
        return false;
    },
    /**
     * Removes all sounds from the sound manager that have an asset key matching the given value.
     * The removed sounds are destroyed before removal.
     *
     * @method Phaser.Sound.BaseSoundManager#removeByKey
     * @param {string} key - The key to match when removing sound objects.
     * @returns {number} The number of matching sound objects that were removed.
     */
    removeByKey: function (key) {
        var removed = 0;
        for (var i = this.sounds.length - 1; i >= 0; i--) {
            var sound = this.sounds[i];
            if (sound.key === key) {
                sound.destroy();
                this.sounds.splice(i, 1);
                removed++;
            }
        }
        return removed;
    },
    /**
     * Pauses all the sounds in the game.
     *
     * @method Phaser.Sound.BaseSoundManager#pauseAll
     */
    pauseAll: function () {
        this.forEachActiveSound(function (sound) {
            sound.pause();
        });
        this.events.dispatch(new SoundEvent(this, 'SOUND_PAUSE'));
    },
    /**
     * Resumes all the sounds in the game.
     *
     * @method Phaser.Sound.BaseSoundManager#resumeAll
     */
    resumeAll: function () {
        this.forEachActiveSound(function (sound) {
            sound.resume();
        });
        this.events.dispatch(new SoundEvent(this, 'SOUND_RESUME'));
    },
    /**
     * Stops all the sounds in the game.
     *
     * @method Phaser.Sound.BaseSoundManager#stopAll
     */
    stopAll: function () {
        this.forEachActiveSound(function (sound) {
            sound.stop();
        });
        this.events.dispatch(new SoundEvent(this, 'SOUND_STOP'));
    },
    /**
     * Method used internally for pausing sound manager if
     * Phaser.Sound.BaseSoundManager#pauseOnBlur is set to true.
     *
     * @override
     * @protected
     * @method Phaser.Sound.BaseSoundManager#onBlur
     */
    onBlur: NOOP,
    /**
     * Method used internally for resuming sound manager if
     * Phaser.Sound.BaseSoundManager#pauseOnBlur is set to true.
     *
     * @override
     * @protected
     * @method Phaser.Sound.BaseSoundManager#onFocus
     */
    onFocus: NOOP,
    /**
     * Update method called on every game step.
     * Removes destroyed sounds and updates every active sound in the game.
     *
     * @protected
     * @method Phaser.Sound.BaseSoundManager#update
     * @param {number} time - The current timestamp as generated by the Request Animation Frame or SetTimeout.
     * @param {number} delta - The delta time elapsed since the last frame.
     */
    update: function (time, delta) {
        for (var i = this.sounds.length - 1; i >= 0; i--) {
            if (this.sounds[i].pendingRemove) {
                this.sounds.splice(i, 1);
            }
        }
        this.sounds.forEach(function (sound) {
            sound.update(time, delta);
        });
    },
    /**
     * Destroys all the sounds in the game and all associated events.
     *
     * @method Phaser.Sound.BaseSoundManager#destroy
     */
    destroy: function () {
        this.game = null;
        this.events.destroy();
        this.events = null;
        this.forEachActiveSound(function (sound) {
            sound.destroy();
        });
        this.sounds = null;
    },
    /**
     * @private
     * @method Phaser.Sound.BaseSoundManager#forEachActiveSound
     * @param {(sound: ISound, index: number, array: ISound[]) => void} callbackfn
     * @param [thisArg=this]
     */
    forEachActiveSound: function (callbackfn, thisArg) {
        var _this = this;
        this.sounds.forEach(function (sound, index) {
            if (!sound.pendingRemove) {
                callbackfn.call(thisArg || _this, sound, index, _this.sounds);
            }
        });
    }
});
/**
 * Global playback rate.
 *
 * @name Phaser.Sound.BaseSoundManager#rate
 * @property {number} rate
 */
Object.defineProperty(BaseSoundManager.prototype, 'rate', {
    get: function () {
        return this._rate;
    },
    set: function (value) {
        this._rate = value;
        this.forEachActiveSound(function (sound) {
            sound.setRate();
        }, this);
        this.events.dispatch(new SoundValueEvent(this, 'SOUND_RATE', value));
    }
});
/**
 * Global detune.
 *
 * @name Phaser.Sound.BaseSoundManager#detune
 * @property {number} detune
 */
Object.defineProperty(BaseSoundManager.prototype, 'detune', {
    get: function () {
        return this._detune;
    },
    set: function (value) {
        this._detune = value;
        this.forEachActiveSound(function (sound) {
            sound.setRate();
        }, this);
        this.events.dispatch(new SoundValueEvent(this, 'SOUND_DETUNE', value));
    }
});
module.exports = BaseSoundManager;
