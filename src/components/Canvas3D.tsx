'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float } from '@react-three/drei';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

// 3D Heart Geometry Shape
function createHeartShape() {
  const shape = new THREE.Shape();
  const x = 0, y = 0;
  shape.moveTo(x + 0.25, y + 0.25);
  shape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
  shape.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
  shape.bezierCurveTo(x - 0.3, y + 0.55, x - 0.1, y + 0.77, x + 0.25, y + 1.0);
  shape.bezierCurveTo(x + 0.6, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
  shape.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
  shape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
  return shape;
}

function FloatingPinkObjects() {
  const mainHeartRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const sphere1Ref = useRef<THREE.Mesh>(null);
  const sphere2Ref = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const extrudeSettings = useMemo(() => ({
    depth: 0.3,
    bevelEnabled: true,
    bevelSegments: 8,
    steps: 2,
    bevelSize: 0.1,
    bevelThickness: 0.12,
  }), []);

  const heartShape = useMemo(() => createHeartShape(), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (mainHeartRef.current) {
      mainHeartRef.current.rotation.y = Math.sin(time * 0.8) * 0.4 + time * 0.2;
      mainHeartRef.current.rotation.x = Math.cos(time * 0.5) * 0.2;
    }

    if (ringRef.current) {
      ringRef.current.rotation.x = time * 0.3;
      ringRef.current.rotation.y = time * 0.5;
    }

    if (sphere1Ref.current) {
      sphere1Ref.current.position.x = Math.cos(time * 0.7) * 2.8;
      sphere1Ref.current.position.y = Math.sin(time * 0.7) * 1.5;
    }

    if (sphere2Ref.current) {
      sphere2Ref.current.position.x = Math.sin(-time * 0.6) * 3.2;
      sphere2Ref.current.position.y = Math.cos(-time * 0.6) * 1.8;
    }

    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(time * 0.6) * 0.25;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        (state.pointer.x * Math.PI) / 8,
        0.05
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -(state.pointer.y * Math.PI) / 10,
        0.05
      );
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central Glowing 3D Heart */}
      <mesh ref={mainHeartRef} position={[0, -0.6, 0]} scale={[1.4, 1.4, 1.4]} rotation={[0, 0, Math.PI]}>
        <extrudeGeometry args={[heartShape, extrudeSettings]} />
        <meshStandardMaterial
          color="#ff2a8d"
          roughness={0.1}
          metalness={0.9}
          emissive="#e11d48"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Orbiting Glowing Neon Pink Ring */}
      <mesh ref={ringRef} position={[0, 0, -0.5]}>
        <torusGeometry args={[2.2, 0.08, 16, 100]} />
        <meshStandardMaterial
          color="#f472b6"
          roughness={0.1}
          metalness={0.95}
          emissive="#db2777"
          emissiveIntensity={0.9}
        />
      </mesh>

      {/* Floating Pink Crystal Sphere 1 */}
      <mesh ref={sphere1Ref} position={[2.8, 1.5, 0]}>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshStandardMaterial
          color="#fb7185"
          roughness={0.15}
          metalness={0.85}
          emissive="#f43f5e"
          emissiveIntensity={0.7}
        />
      </mesh>

      {/* Floating Magenta Crystal Sphere 2 */}
      <mesh ref={sphere2Ref} position={[-2.8, -1.2, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial
          color="#e879f9"
          roughness={0.15}
          metalness={0.85}
          emissive="#c026d3"
          emissiveIntensity={0.65}
        />
      </mesh>

      {/* Floating Small Torus Ring */}
      <Float speed={3} rotationIntensity={2} floatIntensity={2}>
        <mesh position={[-2.5, 1.8, -1]}>
          <torusGeometry args={[0.3, 0.08, 16, 50]} />
          <meshStandardMaterial
            color="#fda4af"
            roughness={0.2}
            metalness={0.8}
            emissive="#e11d48"
            emissiveIntensity={0.5}
          />
        </mesh>
      </Float>
    </group>
  );
}

export default function Canvas3D() {
  return (
    <div className="absolute inset-0 w-full h-full -z-10 bg-gradient-to-b from-[#180022] via-[#120019] to-[#25002a] overflow-hidden">
      {/* Pink Aurora Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-pink-600/30 via-rose-500/20 to-purple-600/25 rounded-full blur-[130px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-gradient-to-br from-magenta-600/20 via-pink-500/25 to-rose-400/20 rounded-full blur-[120px] pointer-events-none" />

      <Canvas camera={{ position: [0, 0, 6], fov: 55 }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={2.5} color="#ff2a8d" />
        <pointLight position={[-10, -10, -10]} intensity={2} color="#fb7185" />
        <pointLight position={[0, -5, 5]} intensity={1.5} color="#c026d3" />
        <directionalLight position={[0, 5, 3]} intensity={1.2} color="#ffffff" />
        
        <FloatingPinkObjects />
        <Stars radius={90} depth={50} count={4000} factor={4.5} saturation={1} fade speed={1.8} />
      </Canvas>
    </div>
  );
}
