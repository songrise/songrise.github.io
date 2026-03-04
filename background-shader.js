(function () {
    class BackgroundTheme {
        getVertexShaderSource() {
            return `
              attribute vec2 a_position;
              void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
              }
            `;
        }

        getFragmentShaderSource() {
            throw new Error('BackgroundTheme subclasses must implement getFragmentShaderSource().');
        }
    }

    class MonoMistTheme extends BackgroundTheme {
        getFragmentShaderSource() {
            return `
              precision highp float;
              
              uniform vec2 u_resolution;
              uniform float u_time;
              uniform vec2 u_mouse;
              
              vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
              vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
              vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
              
              float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                                    -0.577350269189626, 0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy));
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1;
                i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289(i);
                vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
                vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
                m = m*m;
                m = m*m;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                vec3 g;
                g.x = a0.x * x0.x + h.x * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
              }
              
              vec2 warp(vec2 p, float time, vec2 mouse) {
                float slowTime = time * 0.7;
                vec2 mouseInfluence = (mouse - p) * 0.3;
                float mouseDistance = length(mouseInfluence);
                float mousePower = smoothstep(1.8, 0.0, mouseDistance);
                
                float d1 = snoise(p * 0.5 + vec2(slowTime * 0.1, slowTime * 0.08) + mouseInfluence * mousePower * 0.3);
                float d2 = snoise(p * 0.4 + vec2(-slowTime * 0.082, slowTime * 0.06) + vec2(d1) + mouseInfluence * mousePower * 0.2);
                
                return p + vec2(d1, d2) * (0.4 + mousePower * 0.3);
              }
              
              float rand(vec2 co) {
                return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
              }
              
              void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                float aspect = u_resolution.x / u_resolution.y;
                vec2 p = uv * 2.0 - 1.0;
                p.x *= aspect;
                
                float slowTime = u_time * 0.7;
                vec2 warped = warp(p * 0.7, slowTime, u_mouse);
                
                float mouseDistance = length(u_mouse - p);
                float mouseEffect = smoothstep(1.5, 0.0, mouseDistance) * 0.3;
                
                float shape1 = snoise(warped * 0.9 + vec2(slowTime * 0.05, 0.0));
                float shape2 = snoise(warped * 1.2 + vec2(-slowTime * 0.06, slowTime * 0.04));
                float shape3 = snoise(warped * 0.5 + vec2(slowTime * 0.03, -slowTime * 0.07));
                
                float combinedShape = shape1 * 0.5 + shape2 * 0.3 + shape3 * 0.2;
                combinedShape += mouseEffect;
                
                float finalShape = smoothstep(-0.1, 0.6, combinedShape);
                finalShape = pow(finalShape, 1.1);
                
                vec2 lightPos = mix(warped + vec2(sin(slowTime * 0.1), cos(slowTime * 0.13)) * 0.5, u_mouse, 0.3);
                float dist = length(lightPos);
                float glow = smoothstep(1.0, 0.2, dist);
                finalShape = mix(finalShape, 1.0, glow * 0.4);
                finalShape -= mouseEffect * 0.4;
                
                vec3 color = vec3(finalShape);
                float timeSeed = slowTime * 0.3 + sin(slowTime * 0.5) * 0.1 + cos(slowTime * 0.7) * 0.05;
                vec2 grainCoord = gl_FragCoord.xy / u_resolution.xy + vec2(timeSeed);
                float grain = (rand(grainCoord) - 0.5) * 0.7;
                color += vec3(grain);
                
                color = smoothstep(0.15, 0.95, color);
                color = clamp(color, 0.05, 0.7);
                
                gl_FragColor = vec4(color, 1.0);
              }
            `;
        }
    }

    class AuroraTheme extends BackgroundTheme {
        getFragmentShaderSource() {
            return `
              precision highp float;

              uniform vec2 u_resolution;
              uniform float u_time;
              uniform vec2 u_mouse;

              float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
              }

              float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);

                return mix(
                    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
                    u.y
                );
              }

              float fbm(vec2 p) {
                float value = 0.0;
                float amp = 0.5;
                for (int i = 0; i < 5; i++) {
                  value += amp * noise(p);
                  p *= 2.0;
                  amp *= 0.5;
                }
                return value;
              }

              void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                vec2 p = uv * 2.0 - 1.0;
                p.x *= u_resolution.x / u_resolution.y;

                float time = u_time * 0.08;
                vec2 mouse = u_mouse * 0.25;

                float band = fbm(vec2(p.x * 1.2 + mouse.x, p.y * 1.8 - time));
                float veil = fbm(vec2(p.x * 2.8 - time * 0.6, p.y * 1.2 + mouse.y));
                float glow = smoothstep(0.15, 0.95, band * 0.75 + veil * 0.55 - abs(p.y) * 0.35);

                vec3 base = vec3(0.02, 0.03, 0.06);
                vec3 cyan = vec3(0.08, 0.75, 0.82);
                vec3 amber = vec3(0.95, 0.64, 0.24);
                vec3 color = base;

                color += cyan * glow * (0.8 + 0.2 * sin(time * 8.0 + p.x * 3.0));
                color += amber * glow * (0.35 + 0.25 * cos(time * 6.0 - p.y * 4.0));

                float vignette = smoothstep(1.4, 0.2, length(p));
                color *= vignette;

                gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
              }
            `;
        }
    }

    class BackgroundRenderer {
        constructor(canvas, theme) {
            this.canvas = canvas;
            this.theme = theme;
            this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            this.mouseX = 0;
            this.mouseY = 0;
            this.targetMouseX = 0;
            this.targetMouseY = 0;
            this.lastTime = 0;
        }

        init() {
            if (!this.gl) {
                alert('WebGL not supported in your browser');
                return;
            }

            this.bindInput();
            this.setupProgram();
            this.setupBuffers();
            this.bindResize();
            this.startAnimation();
        }

        bindInput() {
            document.addEventListener('mousemove', (e) => {
                this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
                this.targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
            });

            document.addEventListener('touchmove', (e) => {
                if (e.touches.length > 0) {
                    this.targetMouseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
                    this.targetMouseY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
                }
            }, { passive: true });

            document.addEventListener('touchstart', (e) => {
                if (e.touches.length > 0) {
                    this.targetMouseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
                    this.targetMouseY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
                }
            }, { passive: true });
        }

        createShader(type, source) {
            const shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);

            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
                this.gl.deleteShader(shader);
                return null;
            }

            return shader;
        }

        setupProgram() {
            const vertexShader = this.createShader(this.gl.VERTEX_SHADER, this.theme.getVertexShaderSource());
            const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, this.theme.getFragmentShaderSource());

            if (!vertexShader || !fragmentShader) {
                throw new Error('Unable to compile background shaders.');
            }

            this.program = this.gl.createProgram();
            this.gl.attachShader(this.program, vertexShader);
            this.gl.attachShader(this.program, fragmentShader);
            this.gl.linkProgram(this.program);

            if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
                throw new Error(this.gl.getProgramInfoLog(this.program));
            }

            this.positionAttributeLocation = this.gl.getAttribLocation(this.program, 'a_position');
            this.resolutionUniformLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
            this.timeUniformLocation = this.gl.getUniformLocation(this.program, 'u_time');
            this.mouseUniformLocation = this.gl.getUniformLocation(this.program, 'u_mouse');
        }

        setupBuffers() {
            this.positionBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
                -1.0, -1.0,
                1.0, -1.0,
                -1.0, 1.0,
                -1.0, 1.0,
                1.0, -1.0,
                1.0, 1.0
            ]), this.gl.STATIC_DRAW);
        }

        bindResize() {
            const resizeCanvas = () => {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
                this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            };

            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();
        }

        startAnimation() {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            this.frameInterval = 1000 / (isMobile ? 40 : 90);

            const now = new Date();
            this.dateTimeOffset = (
                now.getDate() * 86400 +
                now.getHours() * 3600 +
                now.getMinutes() * 60 +
                now.getSeconds()
            ) % 1000;
            this.startTime = Date.now();

            requestAnimationFrame((currentTime) => this.render(currentTime));
        }

        updateMouse() {
            this.mouseX += (this.targetMouseX - this.mouseX) * 0.08;
            this.mouseY += (this.targetMouseY - this.mouseY) * 0.08;
        }

        render(currentTime) {
            if (currentTime - this.lastTime >= this.frameInterval) {
                this.updateMouse();

                const time = (Date.now() - this.startTime) / 1000 + this.dateTimeOffset;

                this.gl.clearColor(0, 0, 0, 1);
                this.gl.clear(this.gl.COLOR_BUFFER_BIT);

                this.gl.useProgram(this.program);
                this.gl.uniform2f(this.resolutionUniformLocation, this.canvas.width, this.canvas.height);
                this.gl.uniform1f(this.timeUniformLocation, time);
                this.gl.uniform2f(this.mouseUniformLocation, this.mouseX, this.mouseY);

                this.gl.enableVertexAttribArray(this.positionAttributeLocation);
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
                this.gl.vertexAttribPointer(this.positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

                this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

                this.lastTime = currentTime;
            }

            requestAnimationFrame((nextFrame) => this.render(nextFrame));
        }
    }

    const themeRegistry = {
        'mono-mist': MonoMistTheme,
        aurora: AuroraTheme
    };

    const canvas = document.getElementById('canvas');

    if (!canvas) {
        return;
    }

    const themeName = document.body.dataset.backgroundTheme || 'mono-mist';
    const ThemeClass = themeRegistry[themeName] || themeRegistry['mono-mist'];
    const theme = new ThemeClass();

    try {
        const renderer = new BackgroundRenderer(canvas, theme);
        renderer.init();
    } catch (error) {
        console.error('Background renderer failed to initialize:', error);
    }
}());
