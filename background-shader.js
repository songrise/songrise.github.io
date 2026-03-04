(function () {
    const canvas = document.getElementById('canvas');

    if (!canvas) {
        return;
    }

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
        alert('WebGL not supported in your browser');
        return;
    }

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    document.addEventListener('mousemove', (e) => {
        targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            targetMouseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
            targetMouseY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
        }
    }, { passive: true });

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
            targetMouseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
            targetMouseY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
        }
    }, { passive: true });

    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
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

    function createShader(context, type, source) {
        const shader = context.createShader(type);
        context.shaderSource(shader, source);
        context.compileShader(shader);

        if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
            console.error('Shader compilation error:', context.getShaderInfoLog(shader));
            context.deleteShader(shader);
            return null;
        }

        return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
        return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        return;
    }

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
    const timeUniformLocation = gl.getUniformLocation(program, 'u_time');
    const mouseUniformLocation = gl.getUniformLocation(program, 'u_mouse');

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1.0, -1.0,
        1.0, -1.0,
        -1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        1.0, 1.0
    ]), gl.STATIC_DRAW);

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function updateMouse() {
        mouseX += (targetMouseX - mouseX) * 0.08;
        mouseY += (targetMouseY - mouseY) * 0.08;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const targetFPS = isMobile ? 40 : 90;
    const frameInterval = 1000 / targetFPS;
    let lastTime = 0;

    const now = new Date();
    const dateTimeOffset = (
        now.getDate() * 86400 +
        now.getHours() * 3600 +
        now.getMinutes() * 60 +
        now.getSeconds()
    ) % 1000;

    const startTime = Date.now();

    function render(currentTime) {
        if (currentTime - lastTime >= frameInterval) {
            updateMouse();

            const time = (Date.now() - startTime) / 1000 + dateTimeOffset;

            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(program);
            gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
            gl.uniform1f(timeUniformLocation, time);
            gl.uniform2f(mouseUniformLocation, mouseX, mouseY);

            gl.enableVertexAttribArray(positionAttributeLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            lastTime = currentTime;
        }

        requestAnimationFrame(render);
    }

    render();
}());
