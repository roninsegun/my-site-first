export const vertexShader=`
    precision mediump float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    uniform vec2 uMediaSize;
    uniform vec2 uPanelSize;
    uniform int uFitMode; // 0: contain, 1: cover
    varying vec2 vUv;
    varying vec2 vTextureCoord; 
    
    void main() {
        vUv = uv;
        
        if (uFitMode == 1) {
            vec2 ratio = vec2(
                min((uPanelSize.x / uPanelSize.y) / (uMediaSize.x / uMediaSize.y), 1.0),
                min((uPanelSize.y / uPanelSize.x) / (uMediaSize.y / uMediaSize.x), 1.0)
            );
            vTextureCoord = (uv - 0.5) * ratio + 0.5;
        } else {
            vTextureCoord = uv;
        }
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;export const fragmentShader=`
    precision mediump float;
    uniform sampler2D uTexture1;
    uniform sampler2D uTexture2;
    uniform float uMixRatio;
    uniform vec2 uMediaSize;
    uniform vec2 uPanelSize;
    
    uniform float uBlur;           // 模糊强度 (0.0 - 500.0+)
    uniform float uFalloff;        // 模糊衰减强度 (0.0 - 5.0)
    uniform float uFalloffType;    // 衰减类型 (0.0:smoothstep, 1.0:二次, 2.0:三次, 3.0:平方根)
    uniform float uAngle;          // 模糊方向角度 (弧度)
    uniform vec2 uCenter;          // 参考中心点 (0.0 - 1.0)
    uniform float uDispersion;     // 色散强度 (0.0 - 5.0)
    uniform float uNoise;          // 噪点强度 (0.0 - 1.0)
    uniform float uNoiseBlend;     // 噪点混合模式 (0:无混合, 1:亮色混合, 2:暗色混合, 3:亮暗混合)
    uniform float uScale;          // 纹理缩放 (0.5 = 凹陷, 1.0 = 无变化, 2.0 = 凸起)
    uniform vec2 uOrigin;          // falloff起点偏移 (0.0 - 1.0)

    varying vec2 vUv;
    varying vec2 vTextureCoord;
    
    const float PI2 = 6.28318530718;
    const int SAMPLES = 24;
    const float INV_SAMPLES = 1.0 / float(SAMPLES);
    const vec3 LUMA_WEIGHTS = vec3(0.299, 0.587, 0.114);
    const float MAX_DIST = 0.70710678118;
    
    float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    // 改为静态噪点，不再依赖时间
    float noise(vec2 uv) {
        return rand(uv) * 2.0 - 1.0;
    }

    vec4 sampleMixed(vec2 uv) {
        vec4 c1 = texture2D(uTexture1, uv);
        vec4 c2 = texture2D(uTexture2, uv);
        return mix(c1, c2, uMixRatio);
    }
    
    vec2 applyRadialScale(vec2 uv, float scale) {
        vec2 fromCenter = uv - 0.5;
        float distance = length(fromCenter);
        
        if (distance < 0.001) return uv;
        
        float normalizedDistance = distance * 1.41421356237;
        float transformedDistance = pow(normalizedDistance, scale) * MAX_DIST;
        
        return 0.5 + normalize(fromCenter) * transformedDistance;
    }
    
    float calculateNoiseLuminanceFactor(float luminance, int blendMode) {
        if (blendMode == 0) return 1.0;
        
        float smoothLum = smoothstep(0.2, 0.8, luminance);
        
        if (blendMode == 1) {
            return 1.0 - smoothLum * smoothLum;
        } else if (blendMode == 2) {
            return smoothLum * smoothLum;
        } else if (blendMode == 3) {
            float centerBias = 1.0 - abs(luminance - 0.5) * 2.0;
            return max(pow(centerBias, 1.5), 0.1);
        }
        
        return 1.0;
    }
    
    float applyFalloff(float t, int falloffType) {
        if (falloffType == 1) return t * t;
        if (falloffType == 2) return t * t * t;
        if (falloffType == 3) return sqrt(t);
        return smoothstep(0.0, 1.0, t);
    }
    
    void main() {
        if (uBlur <= 0.0) {
            gl_FragColor = sampleMixed(vTextureCoord);
            return;
        }
        
        vec2 scaledTextureCoord = applyRadialScale(vTextureCoord, 1.0 + uScale * 0.2);
        vec2 gradientDirection = vec2(cos(uAngle), sin(uAngle));
        
        vec2 fromOrigin = vUv - uOrigin;
        float projectionOnGradient = dot(fromOrigin, gradientDirection);
        float falloffDistance = clamp(max(projectionOnGradient, 0.0) / 0.7, 0.0, 1.0);
        
        int falloffType = int(uFalloffType + 0.5);
        float falloffCurve = applyFalloff(falloffDistance, falloffType);
        float reversedFalloff = 1.0 - falloffCurve;
        float blurStrength = mix(uBlur, reversedFalloff * uBlur, clamp(uFalloff, 0.0, 1.0));
        
        float dispersionFalloffStrength = mix(uDispersion, reversedFalloff * uDispersion, clamp(uFalloff, 0.0, 1.0));
        float dispersionStrength = dispersionFalloffStrength * blurStrength * 0.5;
        vec2 texelSize = 1.0 / uMediaSize;
        vec2 panelTexelRatio = uPanelSize / uMediaSize;
        float baseRadius = blurStrength * max(texelSize.x, texelSize.y) * max(panelTexelRatio.x, panelTexelRatio.y) * 0.5;
        vec2 dispersionDirection = vec2(-sin(uAngle), cos(uAngle));
        
        vec2 redOffset = dispersionDirection * dispersionStrength * texelSize * -0.7;
        vec2 blueOffset = dispersionDirection * dispersionStrength * texelSize * 0.7;
        
        vec3 channelColors = vec3(0.0);
        float totalWeight = 0.0;
        
        bool hasNoise = false;
        float noiseInfluence = 0.0;
        
        for (int i = 0; i < SAMPLES; i++) {
            float fi = float(i);
            float angle = fi * INV_SAMPLES * PI2;
            vec2 circleDir = vec2(cos(angle), sin(angle));
            
            float randomOffset = rand(vec2(fi, vUv.x + vUv.y)) * 0.5 + 0.5;
            
            if (hasNoise) {
                float noiseValue = noise(vUv + vec2(fi * 0.1));
                randomOffset += noiseValue * noiseInfluence;
            }
            randomOffset = clamp(randomOffset, 0.1, 1.0);
            
            vec2 baseSampleOffset = circleDir * baseRadius * randomOffset;
            float baseWeight = 1.0 - smoothstep(0.0, 1.0, length(baseSampleOffset) / baseRadius);
            
            if (hasNoise) {
                float weightNoise = noise(vUv + vec2(fi * 0.05 + 13.7));
                baseWeight *= (1.0 + weightNoise * uNoise * 0.2);
            }
            baseWeight = max(baseWeight, 0.0);
            
            vec2 sampleCoord = clamp(scaledTextureCoord + baseSampleOffset, 0.0, 1.0);
            vec4 centerSample = sampleMixed(sampleCoord);
            vec4 redSample = sampleMixed(clamp(sampleCoord + redOffset, 0.0, 1.0));
            vec4 blueSample = sampleMixed(clamp(sampleCoord + blueOffset, 0.0, 1.0));
            
            float weight = baseWeight;
            channelColors.r += redSample.r * redSample.a * weight;
            channelColors.g += centerSample.g * centerSample.a * weight;
            channelColors.b += blueSample.b * blueSample.a * weight;
            totalWeight += weight;
        }
        
        vec4 fallbackColor = sampleMixed(scaledTextureCoord);
        channelColors = (totalWeight > 0.0) ? channelColors / totalWeight : fallbackColor.rgb * fallbackColor.a;
        
        if (hasNoise) {
            float finalNoise = noise(vUv * 10.0 + vec2(31.4, 17.2));
            float luminance = dot(channelColors, LUMA_WEIGHTS);
            
            float noiseStrength = uNoise;
            int blendMode = int(uNoiseBlend + 0.5);
            
            if (blendMode > 0) {
                float luminanceFactor = calculateNoiseLuminanceFactor(luminance, blendMode);
                noiseStrength *= luminanceFactor;
            }
            
            float adjustedNoise = finalNoise;
            if (blendMode == 3) {
                if (luminance > 0.8) {
                    adjustedNoise = abs(finalNoise) * sign(finalNoise) * 0.3;
                } else if (luminance < 0.2) {
                    adjustedNoise *= 0.5;
                }
            }
            
            vec3 noiseContribution = vec3(adjustedNoise * noiseStrength * 0.1);
            channelColors = clamp(channelColors + noiseContribution, 0.0, 1.0);
        }
        
        float finalAlpha = max(fallbackColor.a, (blurStrength > 0.0) ? min(blurStrength * 0.01, 1.0) : 0.0);
        gl_FragColor = vec4(channelColors, finalAlpha);
    }
`;
export const __FramerMetadata__ = {"exports":{"fragmentShader":{"type":"variable","annotations":{"framerContractVersion":"1"}},"vertexShader":{"type":"variable","annotations":{"framerContractVersion":"1"}},"__FramerMetadata__":{"type":"variable"}}}
//# sourceMappingURL=./Shaders.map