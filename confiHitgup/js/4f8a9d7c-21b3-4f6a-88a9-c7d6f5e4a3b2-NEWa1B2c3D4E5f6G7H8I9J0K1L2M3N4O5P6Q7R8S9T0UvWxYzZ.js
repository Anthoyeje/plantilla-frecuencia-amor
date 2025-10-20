 import * as THREE from 'three';
        import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
        import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

        const firebaseConfig = {
          apiKey: "AIzaSyBS00MFJpbFcyQmJR2ZXPjFUlLAL6xg7ec",
          authDomain: "frecuencia-de-corazon.firebaseapp.com",
          databaseURL: "https://frecuencia-de-corazon-default-rtdb.firebaseio.com",
          projectId: "frecuencia-de-corazon",
          storageBucket: "frecuencia-de-corazon.firebasestorage.app",
          messagingSenderId: "43462065307",
          appId: "1:43462065307:web:f66a913b0b02f2f6bb9a3e",
          measurementId: "G-X0MBLFF2SY"
        };
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        function createHeartGeometry(uSegments = 64, vSegments = 32) {
            const geometry = new ParametricGeometry(
                (u, v, target) => {
                    u = u * Math.PI * 2;
                    v = v * Math.PI;
                    const sinU = Math.sin(u);
                    const cosU = Math.cos(u);
                    const sin3U = Math.sin(3 * u);
                    const cos2U = Math.cos(2 * u);
                    const cos3U = Math.cos(3 * u);
                    const cos4U = Math.cos(4 * u);
                    const sinV = Math.sin(v);
                    const cosV = Math.cos(v);
                    target.x = (15 * sinU - 4 * sin3U) * sinV;
                    target.y = 8 * cosV;
                    target.z = -(15 * cosU - 5 * cos2U - 2 * cos3U - cos4U) * sinV;
                },
                uSegments,
                vSegments
            );
            return geometry;
        }

        let audioContext, analyser, audioSource;
        let isActive = false;
        let paused = false;
        let offset = 0;
        let startTime = 0;
        const fftSize = 1024;
        let dataArray = new Uint8Array(fftSize / 2).fill(0);
        let currentAudioBuffer = null;
        let enableBass = true;
        let enableMids = true;
        let enableTreble = true;
        let hasInteracted = false;

        const container = document.getElementById('scene-container');
        const audioDataEl = document.getElementById('audio-data');
        const guideText = document.getElementById('guide-text');
        const loadingEl = document.getElementById('loading');
        const loadingText = document.getElementById('loading-text');
        const loadingFill = document.getElementById('loading-fill');
        const playBtn = document.getElementById('play-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const stopBtn = document.getElementById('stop-btn');
        const bassLevel = document.getElementById('bass-level');
        const midsLevel = document.getElementById('mids-level');
        const trebleLevel = document.getElementById('treble-level');
        const systemLevel = document.getElementById('system-level');
        const bassBar = document.getElementById('bass-bar');
        const midsBar = document.getElementById('mids-bar');
        const trebleBar = document.getElementById('treble-bar');
        const toggleBass = document.getElementById('toggle-bass');
        const toggleMids = document.getElementById('toggle-mids');
        const toggleTreble = document.getElementById('toggle-treble');
        const minimizeBtn = document.getElementById('minimize-panel');

        toggleBass.addEventListener('change', () => { enableBass = toggleBass.checked; });
        toggleMids.addEventListener('change', () => { enableMids = toggleMids.checked; });
        toggleTreble.addEventListener('change', () => { enableTreble = toggleTreble.checked; });

        // Minimize panel toggle
        let isMinimized = true;
        audioDataEl.classList.add('minimized');
        minimizeBtn.addEventListener('click', () => {
            isMinimized = !isMinimized;
            audioDataEl.classList.toggle('minimized', isMinimized);
        });

        // Detect interaction to hide guide
        container.addEventListener('mousedown', () => { if (!hasInteracted) { guideText.classList.add('hidden'); hasInteracted = true; } });
        container.addEventListener('touchstart', () => { if (!hasInteracted) { guideText.classList.add('hidden'); hasInteracted = true; } });
        container.addEventListener('wheel', () => { if (!hasInteracted) { guideText.classList.add('hidden'); hasInteracted = true; } });

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.005);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 15, 50);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.04;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.1;
        controls.maxDistance = 120;
        controls.minDistance = 15;
        controls.maxPolarAngle = Math.PI / 1.8;
        controls.minPolarAngle = Math.PI / 3;

        const coreLight = new THREE.PointLight(0xff69b4, 5, 50, 1.5);
        coreLight.position.set(0, 0, 0);
        scene.add(coreLight);

        // Added extra lights for more glow/brillo
        const glowLight1 = new THREE.PointLight(0xff1493, 3, 30, 2);
        glowLight1.position.set(10, 5, 10);
        scene.add(glowLight1);

        const glowLight2 = new THREE.PointLight(0xffc0cb, 3, 30, 2);
        glowLight2.position.set(-10, 5, -10);
        scene.add(glowLight2);

        const spotLight1 = new THREE.SpotLight(0xff1493, 80, 200, Math.PI / 8, 0.5);
        spotLight1.position.set(-50, 60, -30);
        scene.add(spotLight1);

        const spotLight2 = new THREE.SpotLight(0x9370db, 60, 200, Math.PI / 8, 0.5);
        spotLight2.position.set(50, 60, -30);
        scene.add(spotLight2);

        let energyRings = [];
        const energyRingMat = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            ringIndex: { value: 0 },
            audioIntensity: { value: 0.0 }
          },
          vertexShader: `
            uniform float time;
            uniform float ringIndex;
            uniform float audioIntensity;
            varying vec2 vUv;
            void main() {
              vUv = uv;
              vec3 pos = position;
              pos.z += sin(time + ringIndex) * 0.1 * (1.0 + audioIntensity * 0.3);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            uniform float ringIndex;
            uniform float audioIntensity;
            varying vec2 vUv;
            void main() {
              float flow = fract(vUv.x * 4.0 + time * (0.3 + ringIndex * 0.1));
              float pulse = 0.5 + 0.3 * sin(time * 2.0 + ringIndex * 3.0) * (1.0 + audioIntensity * 0.2);
              float intensity = smoothstep(0.0, 0.2, flow) * smoothstep(0.8, 0.6, flow);
              vec3 baseColor = vec3(0.6, 0.1, 0.4);
              vec3 brightColor = vec3(0.8, 0.2, 0.6);
              vec3 color = mix(baseColor, brightColor, intensity) * pulse * 0.8;
              float alpha = (0.2 + 0.5 * intensity) * pulse;
              gl_FragColor = vec4(color, alpha);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        for (let i = 0; i < 3; i++) {
          const energyRingGeo = new THREE.TorusGeometry(4.5 + i * 0.8, 0.1, 16, 64);
          const energyRing = new THREE.Mesh(energyRingGeo, energyRingMat.clone());
          energyRing.material.uniforms.ringIndex.value = i;
          energyRing.position.y = -5 - i * 0.5;
          energyRing.rotation.x = Math.PI / 2;
          scene.add(energyRing);
          energyRings.push({
            mesh: energyRing,
            speed: 0.2 + i * 0.05
          });
        }

        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.6, 0.85);
        composer.addPass(bloomPass);

        const filmPass = new FilmPass(0.15, 0.01, 1024, false);
        composer.addPass(filmPass);

        function showLoading() {
            loadingEl.classList.add('visible');
            loadingFill.style.width = '0%';
        }

        function hideLoading() {
            loadingEl.classList.remove('visible');
        }

        function simulateLoading() {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress > 100) progress = 100;
                loadingFill.style.width = progress + '%';
                if (progress >= 100) {
                    clearInterval(interval);
                    setTimeout(hideLoading, 300);
                }
            }, 100);
            return interval;
        }

        function initAudio() {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = fftSize;
            analyser.smoothingTimeConstant = 0.85;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }

        const onEnded = () => {
            isActive = false;
            paused = false;
            offset = 0;
            playBtn.disabled = false;
            pauseBtn.disabled = true;
            stopBtn.disabled = true;
            systemLevel.textContent = 'ENDED';
        };

        async function loadDefaultAudio() {
            if (!audioContext) initAudio();
            loadingText.textContent = 'Cargando';
            showLoading();
            const simInterval = simulateLoading();
            try {
                const response = await fetch('mus/1.mp3');
                const arrayBuffer = await response.arrayBuffer();
                currentAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                audioDataEl.classList.add('visible');
                playBtn.disabled = false;
                pauseBtn.disabled = true;
                stopBtn.disabled = true;
                systemLevel.textContent = 'READY';
                clearInterval(simInterval);
                loadingFill.style.width = '100%';
                setTimeout(hideLoading, 300);
            } catch (error) {
                console.error("Error loading default audio:", error);
                systemLevel.textContent = 'ERROR';
                clearInterval(simInterval);
                hideLoading();
            }
        }

        const orbitalLayers = [
          { radius: 8.5, plane_count: 3, verticalTilt: 0.1, speedRange: [0.7, 0.9], heightRange: [1.0, 2.0] },
          { radius: 11.0, plane_count: 3, verticalTilt: 0.3, speedRange: [0.5, 0.7], heightRange: [0.5, 1.5] },
          { radius: 13.5, plane_count: 2, verticalTilt: -0.2, speedRange: [0.4, 0.6], heightRange: [0.5, 2.0] }
        ];
       
        let planeIndex = 0;
        const orbitingPlanes = [];
        const planeRings = [];

        // Initial load
        (async () => {
            loadingText.textContent = 'Iniciando';
            showLoading();
            const simInterval = simulateLoading();

            const urlParams = new URLSearchParams(window.location.search);
            const id = urlParams.get('id');
            let status = 'Por defecto';
            let customImages = [];

            if (id) {
                try {
                    const snapshot = await get(ref(db, `ids/${id}`));
                    if (snapshot.exists()) {
                        customImages = snapshot.val().images || [];
                        const lastImg = customImages.length > 0 ? customImages[customImages.length - 1] : null;
                        while (customImages.length < 5) {
                            if (lastImg) {
                                customImages.push(lastImg);
                            } else {
                                break;
                            }
                        }
                        status = 'Carga correcta';
                    }
                } catch (e) {
                    console.error('Error fetching ID:', e);
                }
            }

            // Load textures
            const loadTexture = (url) => new Promise((resolve, reject) => {
                const loader = new THREE.TextureLoader();
                const tex = loader.load(url, resolve, undefined, reject);
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(2, 2);
                return tex;
            });

            let textures = [];
            if (customImages.length > 0 && customImages[0] !== 'data:') { // assume base64 starts with data:
                const texPromises = customImages.map(img => loadTexture(img));
                const texs = await Promise.all(texPromises);
                textures = texs;
            } else {
                const defaultTex = await loadTexture('img/1.jpg');
                for (let i = 0; i < 8; i++) { // enough for planes
                    textures.push(defaultTex);
                }
            }

            // Status message
            const statusEl = document.createElement('div');
            statusEl.id = 'status-message';
            statusEl.textContent = status;
            document.body.appendChild(statusEl);
            setTimeout(() => { statusEl.style.opacity = '1'; }, 100);

            clearInterval(simInterval);
            loadingFill.style.width = '100%';
            setTimeout(hideLoading, 500);

            // Create orbiting planes
            planeIndex = 0;
            orbitingPlanes.length = 0;
            planeRings.length = 0;
            orbitalLayers.forEach(layer => {
              for (let i = 0; i < layer.plane_count; i++) {
                const planeGeo = new THREE.PlaneGeometry(3, 3, 32, 32);
                const planeMat = new THREE.ShaderMaterial({
                  uniforms: {
                     time: { value: 0 },
                     index: { value: planeIndex },
                     map: { value: textures[planeIndex % textures.length] }
                  },
                  vertexShader: `
                     uniform float time;
                     uniform float index;
                     varying vec2 vUv;
                     varying float vIndex;
                     void main(){
                        vUv = uv;
                        vIndex = index;
                        vec3 pos = position;
                        float wave1 = sin(uv.x * 4.0 + time * 0.7 + index);
                        float wave2 = cos(uv.y * 4.0 + time * 0.5);
                        pos.z += wave1 * wave2 * 0.4;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                     }
                  `,
                  fragmentShader: `
                     uniform float time;
                     uniform float index;
                     uniform sampler2D map;
                     varying vec2 vUv;
                     varying float vIndex;
                     void main(){
                       vec4 texColor = texture2D(map, vUv);
                       float pulse = 0.7 + 0.15 * sin(time * 1.2 + vIndex * 0.5);
                       vec3 col = texColor.rgb * pulse * 0.8;
                       float radial = length(vUv - 0.5) * 2.0;
                       float radialPattern = smoothstep(0.8, 1.0, radial);
                       col += vec3(0.8, 0.1, 0.6) * radialPattern * 0.2 * pulse;
                       gl_FragColor = vec4(col, texColor.a * 1.0);
                     }
                  `,
                  side: THREE.DoubleSide,
                  transparent: true
                });
               
                const plane = new THREE.Mesh(planeGeo, planeMat);
                const angleSpacing = (Math.PI * 2) / layer.plane_count;
                const baseAngle = angleSpacing * i;
                const angleOffset = (Math.random() - 0.5) * angleSpacing * 0.3;
                const initialAngle = baseAngle + angleOffset;
                const radiusVariation = Math.random() * 0.4 - 0.2;
                const initialRadius = layer.radius + radiusVariation;
                const heightScale = layer.heightRange[0] + Math.random() * (layer.heightRange[1] - layer.heightRange[0]);
                const initialHeight = Math.sin(initialAngle * 2) * heightScale;
                plane.position.x = initialRadius * Math.cos(initialAngle);
                plane.position.z = initialRadius * Math.sin(initialAngle);
                plane.position.y = initialHeight;
                const tiltMatrix = new THREE.Matrix4().makeRotationX(layer.verticalTilt);
                plane.position.applyMatrix4(tiltMatrix);
                plane.lookAt(0, 0, 0);
                plane.rotation.z = (Math.random() - 0.5) * 0.3;
                const speed = layer.speedRange[0] + Math.random() * (layer.speedRange[1] - layer.speedRange[0]);
                orbitingPlanes.push({
                  mesh: plane,
                  orbitalLayer: layer,
                  initialAngle: initialAngle,
                  angle: initialAngle,
                  radius: initialRadius,
                  height: initialHeight,
                  speed: speed,
                  tiltMatrix: tiltMatrix
                });
                scene.add(plane);
               
                const planeRingGeo = new THREE.TorusGeometry(2.2, 0.08, 16, 48);
                const ringBaseColor = new THREE.Vector3(0.8, 0.1, 0.6);
                const ringBrightColor = new THREE.Vector3(0.8, 0.4, 0.8);
                const planeRingMat = new THREE.ShaderMaterial({
                  uniforms: {
                    time: { value: 0 },
                    baseColor: { value: ringBaseColor },
                    brightColor: { value: ringBrightColor },
                    index: { value: planeIndex }
                  },
                  vertexShader: `
                    uniform float time;
                    uniform float index;
                    varying vec2 vUv;
                    void main() {
                      vUv = uv;
                      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                  `,
                  fragmentShader: `
                    uniform float time;
                    uniform float index;
                    uniform vec3 baseColor;
                    uniform vec3 brightColor;
                    varying vec2 vUv;
                    void main() {
                      float flow = fract(vUv.x * 3.0 - time * 0.7 - index * 0.1);
                      flow = smoothstep(0.0, 0.1, flow) * smoothstep(1.0, 0.7, flow);
                      float pulse = 0.5 + 0.3 * sin(time * 1.5 + index * 2.0);
                      vec3 color = mix(baseColor, brightColor, flow) * pulse * 0.7;
                      float alpha = 0.3 + 0.5 * flow * pulse;
                      gl_FragColor = vec4(color, alpha);
                    }
                  `,
                  transparent: true,
                  blending: THREE.AdditiveBlending,
                  side: THREE.DoubleSide,
                  depthWrite: false
                });
                const planeRing = new THREE.Mesh(planeRingGeo, planeRingMat);
                const ringContainer = new THREE.Group();
                ringContainer.add(planeRing);
                scene.add(ringContainer);
                planeRings.push({
                  mesh: ringContainer,
                  planeMesh: plane,
                  index: planeIndex
                });
                planeIndex++;
              }
            });

            // Load audio
            loadDefaultAudio();
        })();

        document.getElementById('audio-input').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            audioDataEl.classList.add('visible');
            systemLevel.textContent = 'LOADING...';
            loadingText.textContent = 'Cargando';
            showLoading();
            const simInterval = simulateLoading();
            
            if (!audioContext) initAudio();
            if (audioSource) {
                audioSource.onended = null;
                audioSource.stop();
                audioSource.disconnect();
            }
            isActive = false;
            paused = false;
            offset = 0;
            
            const arrayBuffer = await file.arrayBuffer();
            if (audioContext.state === 'closed') initAudio();
            
            try {
                currentAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                clearInterval(simInterval);
                loadingFill.style.width = '100%';
                setTimeout(hideLoading, 300);
                playBtn.disabled = false;
                pauseBtn.disabled = true;
                stopBtn.disabled = true;
                systemLevel.textContent = 'READY';
            } catch (error) {
                console.error("Error decoding audio data:", error);
                clearInterval(simInterval);
                hideLoading();
                systemLevel.textContent = 'ERROR';
            }
        });

        playBtn.addEventListener('click', () => {
            if (audioContext.state === 'suspended') audioContext.resume();
            if (!currentAudioBuffer) return;

            if (isActive && paused) {
                // resume
                audioSource = audioContext.createBufferSource();
                audioSource.buffer = currentAudioBuffer;
                audioSource.connect(analyser);
                analyser.connect(audioContext.destination);
                audioSource.onended = onEnded;
                audioSource.start(0, offset);
                startTime = audioContext.currentTime;
                paused = false;
                playBtn.disabled = true;
                pauseBtn.disabled = false;
                stopBtn.disabled = false;
                systemLevel.textContent = 'PLAYING';
            } else if (!isActive) {
                // start
                offset = 0;
                audioSource = audioContext.createBufferSource();
                audioSource.buffer = currentAudioBuffer;
                audioSource.connect(analyser);
                analyser.connect(audioContext.destination);
                audioSource.onended = onEnded;
                audioSource.start(0);
                startTime = audioContext.currentTime;
                isActive = true;
                paused = false;
                playBtn.disabled = true;
                pauseBtn.disabled = false;
                stopBtn.disabled = false;
                systemLevel.textContent = 'PLAYING';
            }
        });

        pauseBtn.addEventListener('click', () => {
            if (isActive && !paused) {
                const elapsed = audioContext.currentTime - startTime;
                offset += elapsed;
                if (audioSource) {
                    audioSource.onended = null;
                    audioSource.stop();
                }
                paused = true;
                playBtn.disabled = false;
                pauseBtn.disabled = true;
                stopBtn.disabled = false;
                systemLevel.textContent = 'PAUSED';
            }
        });

        stopBtn.addEventListener('click', () => {
            if (isActive) {
                if (audioSource) {
                    audioSource.onended = null;
                    audioSource.stop();
                    audioSource.disconnect();
                }
                isActive = false;
                paused = false;
                offset = 0;
                playBtn.disabled = false;
                pauseBtn.disabled = true;
                stopBtn.disabled = true;
                systemLevel.textContent = 'READY';
            }
        });

        const vertexShader = `
            uniform float u_time;
            uniform float u_intensity;
            varying vec3 v_normal;
            varying vec3 v_position;
            
            float noise(vec3 p) {
                return sin(p.x * 10.0 + u_time) * sin(p.y * 10.0 + u_time) * sin(p.z * 10.0 + u_time);
            }

            void main() {
                v_normal = normal;
                v_position = position;
                
                float displacement = noise(position) * u_intensity * 2.0;
                vec3 newPosition = position + normal * displacement;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
            }
        `;

        const plasmaFragmentShader = `
            uniform float u_time;
            uniform float u_intensity;
            uniform vec3 u_color;
            varying vec3 v_normal;
            varying vec3 v_position;

            float colorNoise(vec3 p) {
                return fract(sin(dot(p, vec3(12.9898, 78.233, 151.7182))) * 43758.5453);
            }

            void main() {
                float n = colorNoise(v_position * (2.0 + u_intensity * 3.0) + u_time * 0.5) * 0.5 + 0.5;
                vec3 color = u_color * (0.8 + n * 0.4);
                gl_FragColor = vec4(color * u_intensity, 1.0);
            }
        `;

        const coronaVertexShader = `
            varying vec3 vNormal;
            varying vec3 vViewPosition;

            void main() {
                vNormal = normalize( normalMatrix * normal );
                vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const coronaFragmentShader = `
            uniform float u_intensity;
            uniform vec3 u_color;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            void main() {
                vec3 viewDir = normalize( vViewPosition );
                float NdotV = abs(dot( vNormal, viewDir ));
                float fresnel = pow( 1.0 - NdotV, 2.5 );
                float intensity = fresnel * (0.3 + u_intensity * 0.7);
                gl_FragColor = vec4(u_color, intensity);
            }
        `;

        class EnhancedCore {
            constructor() {
                const coreSize = 6;
                const plasmaGeom = createHeartGeometry(64, 32);
                this.plasmaUniforms = {
                    u_time: { value: 0.0 },
                    u_intensity: { value: 0.1 },
                    u_color: { value: new THREE.Color(0xff69b4) }
                };
                const plasmaMat = new THREE.ShaderMaterial({
                    uniforms: this.plasmaUniforms,
                    vertexShader: vertexShader,
                    fragmentShader: plasmaFragmentShader,
                    blending: THREE.AdditiveBlending,
                });
                this.plasma = new THREE.Mesh(plasmaGeom, plasmaMat);
                this.plasma.scale.setScalar(coreSize / 16);
                this.plasma.rotation.x = Math.PI / 2;
                scene.add(this.plasma);

                const coronaGeom = createHeartGeometry(48, 24);
                this.coronaUniforms = {
                    u_intensity: { value: 0.1 },
                    u_color: { value: new THREE.Color(0xffc0cb) }
                };
                const coronaMat = new THREE.ShaderMaterial({
                    uniforms: this.coronaUniforms,
                    vertexShader: coronaVertexShader,
                    fragmentShader: coronaFragmentShader,
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    wireframe: false,
                });
                this.corona = new THREE.Mesh(coronaGeom, coronaMat);
                this.corona.scale.setScalar((coreSize * 1.1) / 16);
                this.corona.rotation.x = Math.PI / 2;
                scene.add(this.corona);

                const shieldGeom = createHeartGeometry(32, 16);
                this.originalPositions = shieldGeom.attributes.position.clone();
                const shieldMat = new THREE.MeshStandardMaterial({
                    color: 0xff69b4,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.3,
                    blending: THREE.AdditiveBlending,
                });
                this.shield = new THREE.Mesh(shieldGeom, shieldMat);
                this.shield.scale.setScalar((coreSize * 1.8) / 16);
                this.shield.rotation.x = Math.PI / 2;
                scene.add(this.shield);
            }

            update(audio, bass, treble, time) {
                const overallEnergy = audio.reduce((a, b) => a + b, 0) / (audio.length * 255);
                
                this.plasmaUniforms.u_time.value = time;
                this.plasmaUniforms.u_intensity.value = THREE.MathUtils.lerp(this.plasmaUniforms.u_intensity.value, 0.4 + overallEnergy * 1.8, 0.15);

                this.coronaUniforms.u_intensity.value = THREE.MathUtils.lerp(this.coronaUniforms.u_intensity.value, bass * 1.8, 0.15);

                this.shield.material.opacity = 0.2 + treble * 0.8;

                const positions = this.shield.geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const p = new THREE.Vector3().fromBufferAttribute(this.originalPositions, i);
                    const noise = treble * 3 * Math.sin(p.length() * 2 - time * 2.5);
                    p.multiplyScalar(1 + noise * 0.15);
                    positions.setXYZ(i, p.x, p.y, p.z);
                }
                positions.needsUpdate = true;
                
                coreLight.intensity = 2 + overallEnergy * 9;
            }
        }

        class DigitalRain {
            constructor() {
                const particleCount = 5000;
                const positions = new Float32Array(particleCount * 3);
                this.velocities = new Float32Array(particleCount);

                for (let i = 0; i < particleCount; i++) {
                    positions[i * 3] = (Math.random() - 0.5) * 200;
                    positions[i * 3 + 1] = Math.random() * 150;
                    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
                    this.velocities[i] = -0.15 - Math.random() * 0.3;
                }

                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const material = new THREE.PointsMaterial({
                    color: 0xff69b4,
                    size: 0.2,
                    transparent: true,
                    opacity: 0.7,
                    blending: THREE.AdditiveBlending,
                    sizeAttenuation: true,
                });
                this.points = new THREE.Points(geometry, material);
                scene.add(this.points);
            }

            update(bass) {
                const positions = this.points.geometry.attributes.position.array;
                for (let i = 0; i < positions.length / 3; i++) {
                    positions[i * 3 + 1] += this.velocities[i] * (1 + bass * 5);
                    if (positions[i * 3 + 1] < -50) {
                        positions[i * 3 + 1] = 100;
                    }
                }
                this.points.geometry.attributes.position.needsUpdate = true;
            }
        }

        class OrbitalSystem {
            constructor() {
                this.rings = [];
                this.rings.push(this.createRing(20, 0xff1493, 0.8, 128));
                this.rings.push(this.createRing(28, 0xff69b4, 0.4, 256));
                this.rings.push(this.createRing(36, 0x9370db, 0.2, 512));
            }

            createRing(radius, color, thickness, segments) {
                const curve = new THREE.CatmullRomCurve3(
                    Array.from({ length: segments + 1 }, (_, i) => {
                        const angle = (i / segments) * Math.PI * 2;
                        return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
                    })
                );
                const geometry = new THREE.TubeGeometry(curve, segments, thickness, 8, true);
                const material = new THREE.MeshBasicMaterial({
                    color: color,
                    blending: THREE.AdditiveBlending,
                    transparent: true,
                    opacity: 0.8,
                    wireframe: true
                });
                const ring = new THREE.Mesh(geometry, material);
                ring.userData.radius = radius;
                ring.userData.originalPositions = geometry.attributes.position.clone();
                scene.add(ring);
                return ring;
            }

            update(bass, mids, treble, time) {
                this.updateRing(this.rings[0], bass * 1.5, time, 0.4, 7);
                this.updateRing(this.rings[1], mids * 1.5, time * 1.5, 0.8, 4);
                this.updateRing(this.rings[2], treble * 1.5, time * -2.5, 1.2, 3);
            }

            updateRing(ring, intensity, time, undulationSpeed, amplitude) {
                const positions = ring.geometry.attributes.position;
                const originalPos = ring.userData.originalPositions;
                const radius = ring.userData.radius;

                for (let i = 0; i < positions.count; i++) {
                    const p = new THREE.Vector3().fromBufferAttribute(originalPos, i);
                    const angle = Math.atan2(p.z, p.x);
                    
                    p.y += Math.sin(angle * 8 + time * undulationSpeed) * amplitude * intensity;

                    const r = radius + intensity * 20;
                    const tempP = p.clone().setY(0).normalize().multiplyScalar(r);
                    p.x = tempP.x;
                    p.z = tempP.z;
                    
                    positions.setXYZ(i, p.x, p.y, p.z);
                }
                positions.needsUpdate = true;
                ring.material.opacity = 0.4 + intensity * 0.8;
            }
        }

        class GridFloor {
            constructor() {
                this.grid = new THREE.GridHelper(200, 50, 0xff69b4, 0x33001a);
                this.grid.position.y = -25;
                this.grid.material.transparent = true;
                this.grid.material.opacity = 0.3;
                scene.add(this.grid);
            }

            update(bass) {
                this.grid.material.opacity = 0.3 + bass * 0.6;
            }
        }

        class ArcticRingsSystem {
            constructor() {
                this.effectGroups = {
                    rings: new THREE.Group()
                };
                this.effectGroups.rings.position.set(0, 0, 0);
                scene.add(this.effectGroups.rings);
                this.effectData = {
                    rings: { isActive: false }
                };
                this.ringColors = [
                    new THREE.Color(0xff69b4),
                    new THREE.Color(0xffc0cb),
                    new THREE.Color(0xffffff)
                ];
                this.beatThreshold = 0.6;
                this.lastBeatTime = 0;
                this.beatCooldown = 0.3;
            }

            triggerRings() {
                if (this.effectGroups.rings.children.length) return;
                this.effectData.rings.isActive = true;
                for (let r = 0; r < 5; r++) {
                    const ringGeo = new THREE.RingGeometry(8 + r*1.5, 8.5 + r*1.5, 32);
                    const col = this.ringColors[r % this.ringColors.length];
                    const mat = new THREE.MeshBasicMaterial({ 
                        color: col, 
                        transparent: true, 
                        opacity: 1.0, 
                        blending: THREE.AdditiveBlending, 
                        side: THREE.DoubleSide,
                        wireframe: true
                    });
                    const ring = new THREE.Mesh(ringGeo, mat);
                    ring.rotation.x = Math.PI/2;
                    ring.userData.speed = 0.03 + r*0.02;
                    ring.userData.life = 1.0;
                    this.effectGroups.rings.add(ring);
                }
            }

            updateRings(time) {
                if (!this.effectGroups.rings.children.length) { 
                    this.effectData.rings.isActive = false; 
                    return; 
                }
                for (let i = this.effectGroups.rings.children.length - 1; i >= 0; i--) {
                    const r = this.effectGroups.rings.children[i];
                    r.scale.x += r.userData.speed;
                    r.scale.y += r.userData.speed;
                    r.userData.life -= 0.01;
                    r.material.opacity = r.userData.life;
                    if (r.userData.life <= 0) {
                        r.geometry.dispose();
                        r.material.dispose();
                        this.effectGroups.rings.remove(r);
                    }
                }
            }

            checkBeat(bass, time) {
                if (bass > this.beatThreshold * 0.8 && (time - this.lastBeatTime) > this.beatCooldown) {
                    this.triggerRings();
                    this.lastBeatTime = time;
                }
            }

            update(bass, time) {
                this.checkBeat(bass, time);
                this.updateRings(time);
            }
        }

        const enhancedCore = new EnhancedCore();
        const digitalRain = new DigitalRain();
        const orbitalSystem = new OrbitalSystem();
        const gridFloor = new GridFloor();
        const arcticRingsSystem = new ArcticRingsSystem();

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const time = clock.getElapsedTime();
            
            if (analyser && isActive && !paused) {
                analyser.getByteFrequencyData(dataArray);
            } else {
                for (let i = 0; i < dataArray.length; i++) {
                    dataArray[i] = Math.max(0, Math.floor(dataArray[i] * 0.96));
                }
            }
            
            const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / (10 * 255);
            const mids = dataArray.slice(50, 150).reduce((a, b) => a + b, 0) / (100 * 255);
            const treble = dataArray.slice(200, 300).reduce((a, b) => a + b, 0) / (100 * 255);
            
            const effectiveBass = enableBass ? bass : 0;
            const effectiveMids = enableMids ? mids : 0;
            const effectiveTreble = enableTreble ? treble : 0;
            
            bassLevel.textContent = Math.round(bass * 100).toString().padStart(3, '0');
            midsLevel.textContent = Math.round(mids * 100).toString().padStart(3, '0');
            trebleLevel.textContent = Math.round(treble * 100).toString().padStart(3, '0');
            
            bassBar.style.width = (bass * 100) + '%';
            midsBar.style.width = (mids * 100) + '%';
            trebleBar.style.width = (treble * 100) + '%';
            
            enhancedCore.update(dataArray, effectiveBass, effectiveTreble, time);
            digitalRain.update(effectiveBass);
            orbitalSystem.update(effectiveBass, effectiveMids, effectiveTreble, time);
            gridFloor.update(effectiveBass);
            arcticRingsSystem.update(effectiveBass, time);

            const audioIntensity = effectiveBass;

            energyRings.forEach((ring, i) => {
              ring.mesh.material.uniforms.time.value = time;
              ring.mesh.material.uniforms.audioIntensity.value = audioIntensity;
              ring.mesh.rotation.z = (time * ring.speed + audioIntensity * 0.1) * (i % 2 === 0 ? 1 : -1);
              ring.mesh.position.y = -5 - i * 0.5 + Math.sin(time * 0.5 + i) * 0.3 * (1.0 + audioIntensity * 0.2);
            });

            // Update orbiting planes
            orbitingPlanes.forEach((planeObj, i) => {
              planeObj.mesh.material.uniforms.time.value = time;
              planeObj.angle += 0.002 * planeObj.speed * (1.0 + 0.1 * Math.sin(planeObj.angle * 2));
              const baseX = planeObj.radius * Math.cos(planeObj.angle);
              const baseZ = planeObj.radius * Math.sin(planeObj.angle);
              const heightFactor = Math.sin(planeObj.angle * 2 + planeObj.initialAngle * 3);
              const newHeight = planeObj.height * heightFactor;
              let newPosition = new THREE.Vector3(baseX, newHeight, baseZ);
              newPosition.applyMatrix4(planeObj.tiltMatrix);
              planeObj.mesh.position.copy(newPosition);
              planeObj.mesh.lookAt(0, 0, 0);
              planeObj.mesh.rotation.z = Math.sin(time * 0.2 + i) * 0.1 + Math.sin(i) * 0.2;
            });

            // Update plane rings
            planeRings.forEach((ringObj, i) => {
              const plane = ringObj.planeMesh;
              ringObj.mesh.position.copy(plane.position);
              ringObj.mesh.rotation.copy(plane.rotation);
              ringObj.mesh.children[0].material.uniforms.time.value = time;
              ringObj.mesh.children[0].rotation.z = time * 0.3 + ringObj.index * 0.2;
            });
            
            bloomPass.strength = 0.6 + (effectiveBass * 0.8 + effectiveMids * 0.3 + effectiveTreble * 0.2);
            controls.autoRotateSpeed = 0.1 + effectiveMids * 1.2;
            
            controls.update();
            composer.render();
        }

        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            composer.setSize(width, height);
        });

        animate();