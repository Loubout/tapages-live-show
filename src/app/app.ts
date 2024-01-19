import { Ticker } from '@pixi/ticker';
import * as FILTERS from 'pixi-filters';
import { AdvancedBloomFilter, KawaseBlurFilter } from 'pixi-filters';
import * as PIXI from 'pixi.js';
import { AlphaFilter, Container, Filter } from 'pixi.js';
import { analyze } from 'web-audio-beat-detector';
import { tapagesFrames } from '../assets/loader';
import { AudioCapture } from './audioCapture';
import { config } from './config'


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
        
        const fragSrc = `
        #define NUM_LAYERS 4.

        precision highp float;
        uniform vec3      iResolution;           // viewport resolution (in pixels)
        uniform float     iTime;                 // shader playback time (in seconds)
        uniform vec4      iMouse;                // mouse pixel coords. xy: current (if MLB down), zw: click
        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;

        mat2 Rot(float a) {
            float s = sin(a), c = cos(a);
            return mat2(c, -s, s, c);
        }

        float Star(vec2 uv, float flare){
            float d = length(uv);
            float m = .05/d;
            
            float rays = max(0.,1.-abs(uv.x * uv.y * 1000.));
            m += rays* flare;
            uv *= Rot(3.1415/4.);
            rays = max(0.,1.-abs(uv.x * uv.y * 1000.));
            m += rays * .3 * flare;
            m*= smoothstep(1.,.2,d);
            return m;
        }

        //RNG
        float Hash21(vec2 p){
            p = fract(p*vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        vec3 StarLayer(vec2 uv){
            vec3 col = vec3(0);

            //boxes
            vec2 gv = fract(uv) - 0.5;
            vec2 id = floor(uv);

            for(int y=-1;y<=1;y++){
                for(int x=-1;x<=1;x++){
                    vec2 offs = vec2(x,y);
                    float n=  Hash21(id+offs); // random betwen 0 and 1
                    float size = fract(n*345.32);
                    float star = Star(gv-offs-vec2(n,fract(n*34.))+.5,smoothstep(.8, .9, size));
                    vec3 color = sin(vec3(.2,.3,.9)*fract(n*2345.2)*6.2831* 100.)* 0.5 + 0.5;
                    color = color* vec3(1,.5,1.+size);            
                    color += pow(length(gv - offs) * 0.1,mod(iTime + n,.2));
                    star *= sin(iTime*90.+n*6.2831)*.2+1.;
                    col += size * star * color;
                }
            }
            return col;
        }

        void main(void)
        {
            // Normalized pixel coordinates (from -0.5 to 0.5)
            vec2 uv = (gl_FragCoord.xy -.5*iResolution.xy)/iResolution.y;
            vec2 M = (iMouse.xy -.5*iResolution.xy)/iResolution.y;
            float t = iTime*.01;
            uv += M *4.;
            uv *= Rot(t);
            vec3 col = vec3(0);
            
            for(float i=0.; i<1.; i+=1./NUM_LAYERS) {
                float depth = fract(i+t);
                float scale = mix(20.,.5,depth);
                float fade = depth* smoothstep(1.,.9,depth);
                col += StarLayer(uv*scale+i*453.2-M)*fade;
            }
            
            //red grid
            //if(gv.x > .48 || gv.y > .48) col.r = 1.;
            
            //col.rg += id*.4;
            //col += Hash21(uv);
            
            // Output to screen
            gl_FragColor = vec4(col,1.0);
        }
        `

        const uniforms = {
            iResolution: [this.app.screen.width, this.app.screen.height, 1],
            iTime : 350,
            iMouse: [this.app.screen.width*0.001, this.app.screen.height *0.4, this.app.screen.width*0.2, this.app.screen.height/2]
        }
        const starFilter = new Filter(undefined, fragSrc, uniforms)
        const blurFilter: KawaseBlurFilter = new KawaseBlurFilter(0.2, 3)
        const bloomFilter: AdvancedBloomFilter = new AdvancedBloomFilter({
            threshold: 0.5,
            bloomScale: 0.03,
            brightness: 0.5,
            blur: 0.8,
            quality: 4
        })

        var flip = false
        this.app.ticker.add(() => {
            starFilter.uniforms.iTime += 0.05
            // bloomFilter.bloomScale += 0.01

            // if (bloomFilter.bloomScale > .8) {
            //     bloomFilter.bloomScale = 0.5
            // }
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
            innerStrength: 10,
            color: 0xffb3f0,
            quality: .5,
            knockout: true,
            alpha: .9,
        })
        const shockwaveFilter = new FILTERS.ShockwaveFilter([0.5,0.5], {
            amplitude:40,
            wavelength:150,
            speed:100,
            brightness:1,
            radius:-1,
        },400
        )
        const filterReflection = new FILTERS.ReflectionFilter({
            mirror: false,
            boundary: 0,
            amplitude: [10,30],
            waveLength: [40,80],
            alpha: [1, 1],
        })
        const filterZoomBlur = new FILTERS.ZoomBlurFilter()
        const bpmFilters = [
            [motionBlurFilter, RGCSplitFilter],
            [glowFilter],
            //[shockwaveFilter],
            [filterReflection],
        ]

        const alwaysOnFilters = [ outlineFilter ];
        monkeyContainer.filters = alwaysOnFilters;
        monkey.x = this.app.screen.width / 2;
        monkey.y = this.app.screen.height / 2;
        monkey.height = this.app.screen.width * config.LOGO_SIZE_RATIO;
        monkey.width = monkey.height
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

