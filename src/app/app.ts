import { Ticker } from '@pixi/ticker';
import * as TWEEN from '@tweenjs/tween.js';
import * as FILTERS from 'pixi-filters';
import { AdvancedBloomFilter, KawaseBlurFilter } from 'pixi-filters';
import * as PIXI from 'pixi.js';
import { AlphaFilter, Container, Filter } from 'pixi.js';
import { analyze } from 'web-audio-beat-detector';
import { tapagesFrames } from '../assets/loader';
import { AudioCapture } from './audioCapture';
import { config } from './config'
import { fragmentSrc } from './starFieldFragment';

interface MonkeyFrames {
    main: string;
}

// Prepare frames
const monkeyFrames: MonkeyFrames = tapagesFrames;


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
        const background: PIXI.Sprite = PIXI.Sprite.from('../assets/image/fff.png');
        background.anchor.set(0, 0);
        background.anchor.x = 0;
        background.anchor.y = 0;
        background.width = this.app.screen.width;
        background.height = this.app.screen.height;
        const backgroundContainer = new Container();
        
        const uniforms = {
            iResolution: [this.app.screen.width, this.app.screen.height, 1],
            iTime : 400,
            iMouse: [200, 200, 0, 0]
        }
        const starFilter = new Filter(undefined, fragmentSrc, uniforms)
        const bloomFilter: AdvancedBloomFilter = new AdvancedBloomFilter({
            threshold: 0.5,
            bloomScale: 0.05,
            brightness: 0.5,
            blur: 0.8,
            quality: 4
        })

        var flip = false
        this.app.ticker.add(() => {
            starFilter.uniforms.iTime += 0.06
        })
        backgroundContainer.filters = [starFilter, bloomFilter]
        backgroundContainer.addChild(background)
        return backgroundContainer
    }

    private prepareLogoContainer(): Container {
        const monkeyContainer = new Container();
        const outlineFilter = new FILTERS.OutlineFilter(3, 0x000000, 1)
        const monkey: PIXI.Sprite = PIXI.Sprite.from(monkeyFrames.main);

        const motionBlurFilter = new FILTERS.MotionBlurFilter([30,30], 15)
        const RGCSplitFilter = new FILTERS.RGBSplitFilter([20,0], [12,-3], [2,4])
        const glowFilter = new FILTERS.GlowFilter({
            distance: 10,
            outerStrength: 10,
            innerStrength: 4,
            color: 0xffb3f0,
            quality: .5,
            knockout: true,
            alpha: .9,
        })
        const filterReflection = new FILTERS.ReflectionFilter({
            mirror: false,
            boundary: 0,
            amplitude: [10,30],
            waveLength: [40,80],
            alpha: [1, 1],
        })
        const bpmFilters = [
            [motionBlurFilter, RGCSplitFilter],
            [glowFilter],
            [filterReflection],
        ]

        const alwaysOnFilters = [ outlineFilter ];
        monkeyContainer.filters = alwaysOnFilters;
        monkey.x = this.app.screen.width / 2;
        monkey.y = this.app.screen.height / 2;

        const smallestDimension = Math.min(this.app.screen.width, this.app.screen.height)
        const logoDim = smallestDimension * config.LOGO_SIZE_RATIO
        monkey.height = logoDim;
        monkey.width = logoDim;

        monkey.anchor.set(0.5, 0.5);

        this.app.ticker.add((delta) => {
            filterReflection.time += 0.1
            monkey.rotation += config.LOGO_ROTATION_SPEED
        })
        
        const bpmTicker = new Ticker();
        bpmTicker.minFPS = bpmToFps(config.LOGO_ANIMATIONS_PER_MINUTES)
        bpmTicker.maxFPS = bpmToFps(config.LOGO_ANIMATIONS_PER_MINUTES)
        bpmTicker.start();

        bpmTicker.add((time) => {
            monkeyContainer.filters = monkeyContainer.filters.concat(bpmFilters[(Math.floor(Math.random() * bpmFilters.length))])
            setTimeout(_ => {
                monkeyContainer.filters = alwaysOnFilters
            }, config.LOGO_ANIMATION_DURATION_MS)
        })
        // const animation = new TWEEN.Tween(monkey.scale)
        //     .to([1.15,1], 2000)
        //     .easing(TWEEN.Easing.Bounce.Out); 
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
        //this.setupAudioCapture()
        this.app.stage.addChild(backgroundContainer);
        this.app.stage.addChild(logoContainer);
    }
}

