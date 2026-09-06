import { Canvas, type CanvasProps } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Suspense, useEffect, useState, type ReactNode } from "react";

/**
 * Shared 3D shell for the arcade. Keeps the render pipeline, lighting rig and
 * framing identical across games so they all read as one polished set, and it
 * never renders on the server (WebGL needs a browser).
 */
export function Game3DCanvas({
  children,
  className,
  aspect = 3 / 4,
  bg = "#050a12",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  aspect?: number;
  bg?: string;
} & Omit<CanvasProps, "children">) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className={
        className ??
        "border-border bg-background/60 relative touch-none overflow-hidden rounded-2xl border"
      }
      style={{ width: "min(360px, 88vw)", aspectRatio: String(aspect) }}
    >
      {mounted ? (
        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} {...rest}>
          <color attach="background" args={[bg]} />
          <Suspense fallback={null}>
            <ambientLight intensity={0.55} />
            <hemisphereLight args={["#8fd8ff", "#0a1420", 0.7]} />
            <directionalLight
              position={[6, 12, 6]}
              intensity={2.1}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-camera-left={-14}
              shadow-camera-right={14}
              shadow-camera-top={14}
              shadow-camera-bottom={-14}
            />
            <Environment>
              <Lightformer intensity={1.6} position={[0, 8, 2]} scale={[12, 12, 1]} />
              <Lightformer
                intensity={1.1}
                color="#2ee6c4"
                position={[-6, 2, -2]}
                rotation-y={Math.PI / 2}
                scale={[16, 2, 1]}
              />
              <Lightformer
                intensity={0.9}
                color="#f6c860"
                position={[6, 3, 2]}
                rotation-y={-Math.PI / 2}
                scale={[16, 2, 1]}
              />
            </Environment>
            {children}
          </Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}
