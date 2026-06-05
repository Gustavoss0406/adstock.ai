"use client"

import { useEffect, useState, Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { useGLTF, Environment, ContactShadows } from "@react-three/drei"

function OfficeModel() {
  const { scene } = useGLTF("/office.glb")
  return <primitive object={scene} scale={1.6} position={[0, -0.4, 0]} rotation={[0, 0.3, 0]} />
}

function Loader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#07080A]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        <span className="text-sm text-white/30">Carregando...</span>
      </div>
    </div>
  )
}

export default function OfficeScene() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <Loader />

  return (
    <Suspense fallback={<Loader />}>
      <Canvas
        camera={{ position: [0, 1.2, 5.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />
        <directionalLight position={[-3, 2, -3]} intensity={0.25} />
        <pointLight position={[2, 3, 4]} intensity={0.3} />
        <OfficeModel />
        <Environment preset="studio" />
        <ContactShadows position={[0, -1.8, 0]} opacity={0.3} scale={8} blur={2.5} far={5} />
      </Canvas>
    </Suspense>
  )
}
