// WaveVisualizer.jsx
const { useEffect, useRef } = React;

const WaveVisualizer = ({ visualState, moodColor }) => {
    const canvasRef = useRef(null);

    // Convert hex directly to rgba string with custom opacity
    const hexToRgba = (hex, alpha) => {
        let r = 0, g = 0, b = 0;
        if (!hex) hex = '#06b6d4';
        if (hex.startsWith('#')) hex = hex.substring(1);
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        let width, height;
        const resize = () => {
            width = canvas.parentElement.clientWidth;
            height = canvas.parentElement.clientHeight;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
        };
        window.addEventListener('resize', resize);
        resize();

        let animationId;
        let time = 0;

        // Dynamics mapping based on state
        const getParams = () => {
            switch(visualState) {
                case 'listening':
                    return { speed: 0.1, amplitudeMult: 0.4, lineCount: 3, alpha: [1, 0.8, 0.5] };
                case 'speaking':
                    // Faster pulse with very large amplitude
                    return { speed: 0.15, amplitudeMult: 0.7, lineCount: 3, alpha: [0.9, 0.6, 0.3] };
                case 'playing':
                    return { speed: 0.12, amplitudeMult: 0.6 + (Math.sin(time/10) * 0.15), lineCount: 4, alpha: [0.7, 0.5, 0.3, 0.1] };
                case 'idle':
                default:
                    return { speed: 0.02, amplitudeMult: 0.1, lineCount: 3, alpha: [0.3, 0.2, 0.1] };
            }
        };

        const draw = () => {
            time += 1;
            ctx.clearRect(0, 0, width, height);
            
            const params = getParams();
            const baseAmp = (height / 2) * params.amplitudeMult * 0.5; // Scale amplitude appropriately for radial

            for (let i = 0; i < params.lineCount; i++) {
                ctx.beginPath();
                ctx.lineWidth = i === 0 ? 3 : 2;
                ctx.strokeStyle = hexToRgba(moodColor, params.alpha[i] || 0.3);
                
                const centerX = width / 2;
                const centerY = height / 2;
                const baseRadius = 115; // Safely clears 220px orb (radius 110)
                
                const lobes = 6 + i * 2;
                const phaseDiff = i * 2;
                const speed = params.speed;

                for (let angle = 0; angle <= Math.PI * 2 + 0.1; angle += 0.05) {
                    const displacement = Math.sin(angle * lobes + (time * speed) + phaseDiff) * baseAmp;
                    // Prevent wave from going inside the orb by capping minimum displacement
                    const safeDisplacement = Math.max(-10, displacement); 
                    const r = baseRadius + safeDisplacement;
                    
                    const x = centerX + r * Math.cos(angle);
                    const y = centerY + r * Math.sin(angle);
                    
                    if (angle === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
            }

            animationId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
        };
    }, [visualState, moodColor]);

    return (
        <canvas ref={canvasRef} style={{ display: 'block' }}></canvas>
    );
};

window.WaveVisualizer = WaveVisualizer;
