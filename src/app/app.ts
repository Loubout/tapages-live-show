import { Ticker } from '@pixi/ticker';
import * as TWEEN from '@tweenjs/tween.js';
import * as FILTERS from 'pixi-filters';
import * as PIXI from 'pixi.js';
import { Container, Filter } from 'pixi.js';
import { config } from './config'
import { fragmentSrc } from './starFieldFragment';
import tapagesLogo from '../assets/images/logo_tapages_fanfare_white_no_balls.webp';


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
            iTime : 0,
            iMouse: [this.app.screen.width*.2, this.app.screen.height*.60, 0, 0]
        }
        const starFilter = new Filter(undefined, fragmentSrc, uniforms)
        const overlay = new FILTERS.ColorOverlayFilter(0x000000, .25)
        this.app.ticker.add(() => {
            starFilter.uniforms.iTime += config.STARFIELD_SPEED
        })
        backgroundContainer.filters = [starFilter, overlay]
        backgroundContainer.addChild(background)
        return backgroundContainer
    }

    private prepareLogoFilters(): PIXI.Filter[][] {
        const motionBlurFilter = new FILTERS.MotionBlurFilter([30,30], 15)
        const RGCSplitFilter = new FILTERS.RGBSplitFilter([20,0], [12,-7], [2,4])
        const filterPinkGlow = new FILTERS.GlowFilter({
            distance: 10,
            outerStrength: 10,
            innerStrength: 4,
            color: 0xffb3f0,
            quality: .5,
            knockout: true,
        })
        const filterNeonOrangeGlow = new FILTERS.GlowFilter({
            distance: 10,
            outerStrength: 10,
            innerStrength: 4,
            color: 0xFF6700,
            quality: .5,
            knockout: true,
        })
        const filterReflection = new FILTERS.ReflectionFilter({
            mirror: false,
            boundary: 0,
            amplitude: [10,30],
            waveLength: [40,80],
            alpha: [1, 1],
        })
        const filterColorGradientPrideFlag = new FILTERS.ColorGradientFilter(
            {
                css: 'linear-gradient(to right, rgb(237, 34, 36), rgb(243, 91, 34), rgb(249, 150, 33), rgb(245, 193, 30), rgb(241, 235, 27) 27%, rgb(241, 235, 27), rgb(241, 235, 27) 33%, rgb(99, 199, 32), rgb(12, 155, 73), rgb(33, 135, 141), rgb(57, 84, 165), rgb(97, 55, 155), rgb(147, 40, 142))',
                alpha: 1
            }
        )
        const filterWhiteNeonOutline = new FILTERS.GlowFilter({
            distance: 10,
            outerStrength: 10,
            innerStrength: 4,
            color: 0xFFFFFF,
            quality: .5,
        })
        const filterBlackOverlay = new FILTERS.ColorOverlayFilter(0x000000)

        this.app.ticker.add((delta) => {
            filterColorGradientPrideFlag.angle += 4
            filterReflection.time += .1
        })
        return [
            [RGCSplitFilter, motionBlurFilter],
            [filterPinkGlow],
            [filterReflection],
            [filterColorGradientPrideFlag],
            [filterNeonOrangeGlow],
            [filterBlackOverlay, filterWhiteNeonOutline],
            []
        ]
    }
    private prepareLogoContainer(): Container {
        const monkeyContainer = new Container();
        const monkey: PIXI.Sprite = PIXI.Sprite.from(tapagesLogo);

        // center logo
        monkey.x = this.app.screen.width / 2;
        monkey.y = this.app.screen.height / 2;

        // set dimensions
        const smallestDimension = Math.min(this.app.screen.width, this.app.screen.height)
        const logoDim = smallestDimension * config.LOGO_SIZE_RATIO
        monkey.height = logoDim;
        monkey.width = logoDim;
        monkey.anchor.set(0.5, 0.5);

        const randomizedFilters = this.prepareLogoFilters()

        // setup bounce animation
        const monkeyBaseDimension = { width: monkey.width, height: monkey.height }
        const animationObject = { val: 1 }
        const bounceAnimation = new TWEEN.Tween(animationObject)
            .to({val: 1.15}, 150)
            .yoyo(true)
            .repeat(1)
            .easing(TWEEN.Easing.Bounce.InOut)
            .onUpdate(() => {
                monkey.width = monkeyBaseDimension.width * animationObject.val
                monkey.height = monkeyBaseDimension.height * animationObject.val
            })

        // sync to bpm value config
        const bpmTicker = new Ticker();
        bpmTicker.minFPS = bpmToFps(config.LOGO_ANIMATIONS_PER_MINUTES)
        bpmTicker.maxFPS = bpmToFps(config.LOGO_ANIMATIONS_PER_MINUTES)
        bpmTicker.start();

        bpmTicker.add((_) => {
            monkeyContainer.filters = randomizedFilters[(Math.floor(Math.random() * randomizedFilters.length))]
            bounceAnimation.start()
        })

        this.app.ticker.add((delta) => {
            monkey.rotation += config.LOGO_ROTATION_SPEED
            bounceAnimation.update()
        })

        monkeyContainer.addChild(monkey)
        return monkeyContainer
    }

    private init() {
        const backgroundContainer = this.prepareBackgroundContainer();
        const logoContainer = this.prepareLogoContainer();
        this.app.stage.addChild(backgroundContainer);
        this.app.stage.addChild(logoContainer);
    }
}
