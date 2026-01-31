import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";
import { calculateLinkData, linkColors } from "@/data/networkData";

interface CellNodeProps {
  position: [number, number, number];
  color: string;
  label: string;
  isIsolated?: boolean;
}

function CellNode({ position, color, label, isIsolated }: CellNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      if (hovered) {
        meshRef.current.scale.setScalar(1.3);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {isIsolated ? (
          <octahedronGeometry args={[0.15, 0]} />
        ) : (
          <sphereGeometry args={[0.12, 16, 16]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.8 : 0.3}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      <Text
        position={[0, 0.25, 0]}
        fontSize={0.1}
        color={hovered ? "#ffffff" : "#888888"}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

interface LinkGroupProps {
  linkId: number;
  cells: string[];
  color: string;
  angle: number;
  isIsolated: boolean;
}

function LinkGroup({ linkId, cells, color, angle, isIsolated }: LinkGroupProps) {
  // Calculate positions for cells on this link
  const radius = isIsolated ? 2.5 : 2;
  const cellPositions = useMemo(() => {
    if (cells.length === 1) {
      return [[radius * Math.cos(angle), 0, radius * Math.sin(angle)] as [number, number, number]];
    }

    const spread = Math.PI / 8;
    const startAngle = angle - spread * (cells.length - 1) / 2;
    
    return cells.map((_, i) => {
      const cellAngle = startAngle + i * spread;
      const cellRadius = radius + (i % 2) * 0.3;
      return [
        cellRadius * Math.cos(cellAngle),
        (i - (cells.length - 1) / 2) * 0.3,
        cellRadius * Math.sin(cellAngle),
      ] as [number, number, number];
    });
  }, [cells.length, angle, radius]);

  const hubRadius = 1;
  const hubPosition: [number, number, number] = [
    hubRadius * Math.cos(angle),
    0,
    hubRadius * Math.sin(angle),
  ];

  return (
    <group>
      {/* Link hub */}
      {!isIsolated && (
        <mesh position={hubPosition}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Connection line from BBU to hub */}
      <Line
        points={[[0, 0, 0], hubPosition]}
        color={color}
        lineWidth={isIsolated ? 1 : 2}
      />

      {/* Cells and their connections */}
      {cells.map((cellId, i) => {
        const cellPos = cellPositions[i];
        return (
          <group key={cellId}>
            <Line
              points={[isIsolated ? [0, 0, 0] : hubPosition, cellPos]}
              color={color}
              lineWidth={1}
            />
            <CellNode
              position={cellPos}
              color={color}
              label={cellId}
              isIsolated={isIsolated}
            />
          </group>
        );
      })}

      {/* Link label */}
      {!isIsolated && (
        <Text
          position={[hubPosition[0] * 0.7, 0.4, hubPosition[2] * 0.7]}
          fontSize={0.12}
          color={color}
          anchorX="center"
          anchorY="middle"
        >
          {`Link_${linkId}`}
        </Text>
      )}
    </group>
  );
}

function BBUNode() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.5}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.15}
        color="#22d3ee"
        anchorX="center"
        anchorY="middle"
      >
        BBU
      </Text>
    </group>
  );
}

function Scene() {
  const linkData = useMemo(() => calculateLinkData(), []);

  const sharedLinks = linkData.filter((l) => !l.isolated);
  const isolatedLinks = linkData.filter((l) => l.isolated);

  const sharedAngles = sharedLinks.map((_, i) => 
    (i / sharedLinks.length) * Math.PI * 2 - Math.PI / 2
  );

  const isolatedAngles = isolatedLinks.map((_, i) => 
    ((i + 0.5) / isolatedLinks.length) * Math.PI * 2 + Math.PI / 4
  );

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#c084fc" />

      <gridHelper args={[8, 20, "#333333", "#222222"]} />

      <BBUNode />

      {sharedLinks.map((link, i) => (
        <LinkGroup
          key={link.linkId}
          linkId={link.linkId}
          cells={link.cells}
          color={linkColors[link.linkId]}
          angle={sharedAngles[i]}
          isIsolated={false}
        />
      ))}

      {isolatedLinks.map((link, i) => (
        <LinkGroup
          key={link.linkId}
          linkId={link.linkId}
          cells={link.cells}
          color={linkColors[link.linkId]}
          angle={isolatedAngles[i]}
          isIsolated={true}
        />
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={10}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export function NetworkTopology3D() {
  const linkData = useMemo(() => calculateLinkData(), []);
  const sharedLinks = linkData.filter((l) => !l.isolated);

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden bg-black">
      <Canvas
        camera={{ position: [4, 3, 4], fov: 50 }}
      >
        <Scene />
      </Canvas>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-xs space-y-2">
        <div className="text-muted-foreground font-medium mb-2">Legend</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-cyan-400 rounded" />
          <span className="text-foreground">BBU (Central)</span>
        </div>
        {sharedLinks.slice(0, 5).map((link) => (
          <div key={link.linkId} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: linkColors[link.linkId] }}
            />
            <span className="text-muted-foreground">
              {link.linkName} ({link.cells.length} cells)
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <div className="w-3 h-3 bg-muted-foreground/50 rotate-45" />
          <span className="text-muted-foreground">Isolated cells</span>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg">
        <span className="text-foreground">Controls:</span> Drag to rotate • Scroll to zoom • Auto-rotating
      </div>
    </div>
  );
}
