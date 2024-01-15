import { Ticker } from '@pixi/ticker';
import * as FILTERS from 'pixi-filters';
import { AdvancedBloomFilter, KawaseBlurFilter } from 'pixi-filters';
import * as PIXI from 'pixi.js';
import { AlphaFilter, Container } from 'pixi.js';
import { analyze } from 'web-audio-beat-detector';
import { background, tapagesFrames } from '../assets/loader';
import { AudioCapture } from './audioCapture';

interface MonkeyFrames {
    main: string;
}

const CONFIG = {
    BEAT_ANIMATION_DURATION_MS: 200
}

// Prepare frames
const monkeyFrames: MonkeyFrames = tapagesFrames;
const backgroundFrame = background


const bpmToFps = (bpmValue: number) => {
    return bpmValue / 60
}

export class GameApp {
    private app: PIXI.Application;

    constructor(parent: HTMLElement, width: number, height: number) {
        this.app = new PIXI.Application({width, height, backgroundColor : 0x111111, resizeTo: window, sharedTicker: true});
        parent.appendChild(this.app.view); // Hack for parcel HMR

        this.init();
    }   

    private prepareBackgroundContainer(): Container {
        const background: PIXI.Sprite = PIXI.Sprite.from(backgroundFrame.main);
        background.anchor.set(0, 0);
        background.anchor.x = 0;
        background.anchor.y = 0;
        background.width = this.app.screen.width;
        background.height = this.app.screen.height;
        const backgroundContainer = new Container();
        
        const alphaFilter: AlphaFilter = new AlphaFilter(0.5)

        const blurFilter: KawaseBlurFilter = new KawaseBlurFilter(0.2, 3)
        const bloomFilter: AdvancedBloomFilter = new AdvancedBloomFilter({
            threshold: 0.5,
            bloomScale: 2,
            brightness: 1,
            blur: 0,
            quality: 4
        })

        var flip = false
        this.app.ticker.add(() => {

            if (flip) {
                bloomFilter.blur += 0.002
                bloomFilter.brightness += 0.005
            } else {
                bloomFilter.blur -= 0.002
                bloomFilter.brightness -= 0.005
            }

            if (bloomFilter.brightness > 1.8 || bloomFilter.brightness < 0.5) {
                flip = !flip
            }
        })
        backgroundContainer.filters = [alphaFilter, bloomFilter, blurFilter]
        backgroundContainer.addChild(background)
        return backgroundContainer
    }

    private prepareLogoContainer(): Container {
        const monkeyContainer = new Container();
        const outlineFilter = new FILTERS.OutlineFilter(2, 0x000000, 1)

        const monkey: PIXI.Sprite = PIXI.Sprite.from(monkeyFrames.main);
        const motionBlurFilter = new FILTERS.MotionBlurFilter([30,30], 15)
        const RGCSplitFilter = new FILTERS.RGBSplitFilter([5,0], [7,0], [2,0])

        const bpmFilters = [motionBlurFilter, RGCSplitFilter]

        const alwaysOnFilters = [ outlineFilter ];
        monkeyContainer.filters = alwaysOnFilters;
        monkey.x = this.app.screen.width / 2;
        monkey.y = this.app.screen.height / 2;
        monkey.height = this.app.screen.width * 0.4;
        monkey.width = monkey.height
        monkey.anchor.set(0.5, 0.5);


        this.app.ticker.add((delta) => {
            monkey.rotation += .0005
        })
        const BPM = 80
        const bpmTicker = new Ticker();
        bpmTicker.minFPS = bpmToFps(BPM)
        bpmTicker.maxFPS = bpmToFps(BPM)
        bpmTicker.start();

        bpmTicker.add((time) => {
            monkeyContainer.filters = monkeyContainer.filters.concat(bpmFilters)
            setTimeout(_ => {
                monkeyContainer.filters = alwaysOnFilters
            }, CONFIG.BEAT_ANIMATION_DURATION_MS)
        })

        monkeyContainer.addChild(monkey)

        return monkeyContainer
    }

    private async setupAudioCapture() {
        const audioCapture = new AudioCapture();
        const audioBuffer = await audioCapture.getAudioBuffer();
        analyze(audioBuffer)
            .then((tempo) => {
                console.log(tempo)
            })
            .catch((error) => {
                console.error(error)
            })
    }

    private init() {
        const backgroundContainer = this.prepareBackgroundContainer();
        const logoContainer = this.prepareLogoContainer();
        this.setupAudioCapture()
        this.app.stage.addChild(backgroundContainer);
        this.app.stage.addChild(logoContainer);
    }
}

