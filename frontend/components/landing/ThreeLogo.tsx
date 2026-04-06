"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function ThreeLogo() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    // --- Setup Scene, Camera, and Renderer ---
    const scene = new THREE.Scene();
    scene.background = null; // Set to null so the CSS background shows through

    // Use a narrow FOV to simulate the near-isometric perspective of the image
    const camera = new THREE.PerspectiveCamera(25, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 80);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimize for high DPI
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Disable zoom to prevent the 3D canvas from hijacking the page scroll
    controls.enableZoom = false;
    
    // Restrict rotation slightly to keep the logo readable
    controls.minDistance = 70;
    controls.maxDistance = 90;

    // --- Generate Real-time Studio Environment Map for Premium Reflections ---
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x020202); // Deep dark background
    
    const lightGeo = new THREE.PlaneGeometry(60, 60);
    const stripGeo = new THREE.PlaneGeometry(10, 100);
    
    const mainLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const rimLightMat = new THREE.MeshBasicMaterial({ color: 0x888888 }); // Softer fill reflection
    
    // Large Overhead/Left Softbox for the main broad highlight
    const panel1 = new THREE.Mesh(lightGeo, mainLightMat);
    panel1.position.set(-30, 40, 30);
    panel1.lookAt(0, 0, 0);
    envScene.add(panel1);

    // Right Strip Light for a sharp edge reflection
    const panel2 = new THREE.Mesh(stripGeo, mainLightMat);
    panel2.position.set(40, 0, 10);
    panel2.lookAt(0, 0, 0);
    envScene.add(panel2);

    // Back-Left Rim Light for extra depth
    const panel3 = new THREE.Mesh(stripGeo, rimLightMat);
    panel3.position.set(-40, -20, -20);
    panel3.lookAt(0, 0, 0);
    envScene.add(panel3);

    // Setup CubeCamera to capture the environment
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(512, {
        format: THREE.RGBAFormat,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter
    });
    const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
    cubeCamera.update(renderer, envScene);

    // --- Materials ---
    const currentMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x0a0a0a,      // Lifted slightly from pure black for better volume visibility
        metalness: 1.0,       // 100% metallic
        roughness: 0.08,      // Very smooth, but allows slight light spread
        clearcoat: 0.3,       // Subtle extra polish layer
        clearcoatRoughness: 0.02,
        envMap: cubeRenderTarget.texture,
        envMapIntensity: 2.8  // Boosted slightly for richer reflections
    });

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // --- Geometry Helpers ---
    function createRoundedRectShape(size: number, radius: number) {
        const s = size / 2;
        const shape = new THREE.Shape();
        shape.moveTo(-s, -s + radius);
        shape.lineTo(-s, s - radius);
        shape.quadraticCurveTo(-s, s, -s + radius, s);
        shape.lineTo(s - radius, s);
        shape.quadraticCurveTo(s, s, s, s - radius);
        shape.lineTo(s, -s + radius);
        shape.quadraticCurveTo(s, -s, s - radius, -s);
        shape.lineTo(-s + radius, -s);
        shape.quadraticCurveTo(-s, -s, -s, -s + radius);
        return shape;
    }

    const baseDepth = 2.4; // Reduced from 3.8 to make the model thinner
    const baseBevel = 0.15;

    // --- 1. Create the Outer Ring (Using Lathe for flawless continuity) ---
    const ringOuterRadius = 14;
    const ringInnerRadius = 11.2;
    const halfDepth = baseDepth / 2;
    const points = [];
    const bevelSteps = 12;
    
    for(let i = 0; i <= bevelSteps; i++) {
        const angle = Math.PI * 1.5 + (Math.PI * 0.5 * (i / bevelSteps)); 
        points.push(new THREE.Vector2(ringOuterRadius - baseBevel + Math.cos(angle) * baseBevel, -halfDepth + baseBevel + Math.sin(angle) * baseBevel));
    }
    for(let i = 0; i <= bevelSteps; i++) {
        const angle = 0 + (Math.PI * 0.5 * (i / bevelSteps)); 
        points.push(new THREE.Vector2(ringOuterRadius - baseBevel + Math.cos(angle) * baseBevel, halfDepth - baseBevel + Math.sin(angle) * baseBevel));
    }
    for(let i = 0; i <= bevelSteps; i++) {
        const angle = Math.PI * 0.5 + (Math.PI * 0.5 * (i / bevelSteps)); 
        points.push(new THREE.Vector2(ringInnerRadius + baseBevel + Math.cos(angle) * baseBevel, halfDepth - baseBevel + Math.sin(angle) * baseBevel));
    }
    for(let i = 0; i <= bevelSteps; i++) {
        const angle = Math.PI + (Math.PI * 0.5 * (i / bevelSteps)); 
        points.push(new THREE.Vector2(ringInnerRadius + baseBevel + Math.cos(angle) * baseBevel, -halfDepth + baseBevel + Math.sin(angle) * baseBevel));
    }
    points.push(points[0].clone());

    const ringGeometry = new THREE.LatheGeometry(points, 200);
    ringGeometry.rotateX(Math.PI / 2); 
    
    const ring = new THREE.Mesh(ringGeometry, currentMaterial);
    ring.castShadow = true;
    ring.receiveShadow = true;
    mainGroup.add(ring);

    // --- 2. Create the Three Center Cubes ---
    const cubeSize = 3.8;
    const cubeRadius = 0.15;
    const cubeShape = createRoundedRectShape(cubeSize, cubeRadius);
    
    const cubeGeometry = new THREE.ExtrudeGeometry(cubeShape, {
        depth: baseDepth - (baseBevel * 2),
        bevelEnabled: true,
        bevelSegments: 12,
        steps: 1,
        bevelSize: baseBevel,
        bevelThickness: baseBevel
    });
    cubeGeometry.center();

    const cubesGroup = new THREE.Group();
    const spacing = 5.2;

    for (let i = 0; i < 3; i++) {
        const cube = new THREE.Mesh(cubeGeometry, currentMaterial);
        cube.position.y = (1 - i) * spacing;
        cube.castShadow = true;
        cube.receiveShadow = true;
        cubesGroup.add(cube);
    }
    
    cubesGroup.position.y = 3.2;
    mainGroup.add(cubesGroup);

    mainGroup.rotation.x = 0.35;
    mainGroup.rotation.y = -0.45;
    mainGroup.rotation.z = -0.1;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5ea, 2.2); 
    dirLight.position.set(-15, 25, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    const d = 20;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xeaf2ff, 1.2); 
    fillLight.position.set(20, 5, 15);
    scene.add(fillLight);

    const frontLight = new THREE.DirectionalLight(0xfff8f0, 0.8);
    frontLight.position.set(0, 0, 30);
    scene.add(frontLight);

    const backRimLight1 = new THREE.PointLight(0xffffff, 1.0, 100);
    backRimLight1.position.set(-20, 20, -20);
    scene.add(backRimLight1);

    const backRimLight2 = new THREE.PointLight(0xffffff, 1.0, 100);
    backRimLight2.position.set(20, -20, -20);
    scene.add(backRimLight2);

    // --- Animation / Render Loop ---
    const clock = new THREE.Clock();
    let animationFrameId: number;

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        mainGroup.rotation.y += 0.5 * delta;
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Handle window resize dynamically
    const handleResize = () => {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
        controls.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
        }
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
}
